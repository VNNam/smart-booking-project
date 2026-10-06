/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Idempotency Middleware (TypeScript / Express & NestJS Compatible)
 * FILE: src/middleware/idempotency.ts
 * MÔ TẢ: Middleware chặn lặp request (Deduplication) và chống Race Condition khi
 *       người dùng bấm đúp nút đặt phòng/thanh toán ví, sử dụng Redis làm distributed cache.
 * 
 * NGUYÊN LÝ HOẠT ĐỘNG:
 * 1. Kiểm tra header `Idempotency-Key` (UUIDv4) trên các HTTP request thay đổi trạng thái (POST, PATCH).
 * 2. Sử dụng Redis atomic SETNX để thiết lập trạng thái 'IN_PROGRESS' (TTL 30s) chống concurrent click.
 *    - Nếu request thứ 2 đến trong lúc request 1 đang chạy: Trả về HTTP 409 Conflict.
 * 3. Nếu request đã hoàn tất trước đó ('COMPLETED'): Trả về ngay lập tức dữ liệu response đã lưu
 *    từ Redis với header `X-Cache-Lookup: HIT-IDEMPOTENT`, bỏ qua việc thực thi controller/service.
 * 4. Chặn và lưu trữ response body thành công (HTTP < 500) vào Redis với TTL 24 giờ.
 * 5. Nếu server gặp lỗi 5xx, giải phóng khóa IN_PROGRESS để client có thể retry.
 * ==============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

// Regex chuẩn kiểm tra tính hợp lệ của UUID v4
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface IdempotencyRecord {
    status: 'IN_PROGRESS' | 'COMPLETED';
    statusCode?: number;
    body?: any;
    headers?: Record<string, string>;
    createdAt: string;
}

export interface IdempotencyOptions {
    /** Tên header chứa khóa định danh duy nhất (Mặc định: 'Idempotency-Key') */
    headerName?: string;
    /** Tiền tố key lưu trữ trong Redis (Mặc định: 'idempotency:') */
    keyPrefix?: string;
    /** Thời gian lưu kết quả phản hồi trong Redis (Mặc định: 86400 giây = 24 giờ) */
    responseTtlSeconds?: number;
    /** Thời gian khóa giữ chỗ khi đang xử lý (Mặc định: 30 giây) */
    lockTtlSeconds?: number;
    /** Bắt buộc phải có header hay không (Mặc định: true đối với POST) */
    enforceHeader?: boolean;
}

/**
 * Factory tạo Idempotency Middleware kết nối với instance Redis
 */
export function createIdempotencyMiddleware(
    redisClient: Redis,
    options: IdempotencyOptions = {}
) {
    const {
        headerName = 'Idempotency-Key',
        keyPrefix = 'idempotency:',
        responseTtlSeconds = 86400, // 24 giờ
        lockTtlSeconds = 30,        // 30 giây bảo vệ concurrent processing
        enforceHeader = true
    } = options;

    return async function idempotencyMiddleware(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        // Chỉ áp dụng cho các HTTP Method ghi dữ liệu có nguy cơ trùng lặp (POST, PATCH)
        if (req.method !== 'POST' && req.method !== 'PATCH') {
            return next();
        }

        // 1. Trích xuất Idempotency Key từ Request Header
        const rawKey = req.header(headerName) || req.header(headerName.toLowerCase());

        if (!rawKey) {
            if (enforceHeader) {
                res.status(400).json({
                    code: 'MISSING_IDEMPOTENCY_KEY',
                    message: `Header '${headerName}' (chuỗi UUIDv4 duy nhất) là bắt buộc cho giao dịch này để chống gửi lặp request.`
                });
                return;
            }
            return next();
        }

        // 2. Validate định dạng UUIDv4
        const idempotencyKey = rawKey.trim();
        if (!UUID_V4_REGEX.test(idempotencyKey)) {
            res.status(400).json({
                code: 'INVALID_IDEMPOTENCY_KEY',
                message: `Header '${headerName}' phải đúng định dạng UUIDv4 (Ví dụ: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb99).`
            });
            return;
        }

        // Gắn tiền tố user id (nếu có user trong session) để cô lập namespace giữa các người dùng
        const userId = (req as any).user?.id || 'anonymous';
        const redisKey = `${keyPrefix}${userId}:${idempotencyKey}`;

        try {
            // 3. Kiểm tra bản ghi đã tồn tại trong Redis chưa
            const existingRawData = await redisClient.get(redisKey);

            if (existingRawData) {
                const record: IdempotencyRecord = JSON.parse(existingRawData);

                // Kịch bản A: Request trước đó vẫn đang trong quá trình tính toán / gọi DB
                if (record.status === 'IN_PROGRESS') {
                    res.status(409).json({
                        code: 'CONCURRENT_REQUEST',
                        message: 'Yêu cầu với Idempotency-Key này đang được xử lý trong hệ thống. Vui lòng chờ kết quả, không ấn lặp lại.'
                    });
                    return;
                }

                // Kịch bản B: Request đã hoàn tất thành công trong vòng 24 giờ qua (Cache Hit)
                if (record.status === 'COMPLETED' && record.statusCode) {
                    res.setHeader('X-Cache-Lookup', 'HIT-IDEMPOTENT');
                    res.setHeader('X-Original-Timestamp', record.createdAt);

                    // Khôi phục response headers đã lưu nếu có
                    if (record.headers) {
                        for (const [hKey, hVal] of Object.entries(record.headers)) {
                            res.setHeader(hKey, hVal);
                        }
                    }

                    res.status(record.statusCode).json(record.body);
                    return;
                }
            }

            // 4. Khởi tạo khóa nguyên tử 'IN_PROGRESS' bằng SETNX + EX
            const inProgressPayload: IdempotencyRecord = {
                status: 'IN_PROGRESS',
                createdAt: new Date().toISOString()
            };

            const acquired = await redisClient.set(
                redisKey,
                JSON.stringify(inProgressPayload),
                'EX',
                lockTtlSeconds,
                'NX'
            );

            if (!acquired) {
                // Đã có tiến trình khác vừa nhanh hơn 1 mili-giây chiếm lock
                res.status(409).json({
                    code: 'CONCURRENT_REQUEST',
                    message: 'Yêu cầu với Idempotency-Key này đang được xử lý đồng thời. Vui lòng không gửi lặp lại.'
                });
                return;
            }

            // Gắn Idempotency-Key vào request context để service/controller có thể sử dụng (VD: ghi vào bảng giao dịch ví)
            (req as any).idempotencyKey = idempotencyKey;

            // 5. Hook vào phương thức response của Express (res.send / res.json) để chặn và lưu kết quả
            const originalSend = res.send.bind(res);
            const originalJson = res.json.bind(res);

            let responseBodyCaptured: any = null;

            // Override res.json
            res.json = function (body: any): Response {
                responseBodyCaptured = body;
                return originalJson(body);
            };

            // Override res.send
            res.send = function (chunk: any): Response {
                if (!responseBodyCaptured && chunk) {
                    try {
                        responseBodyCaptured = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;
                    } catch {
                        responseBodyCaptured = chunk;
                    }
                }
                return originalSend(chunk);
            };

            // 6. Lắng nghe sự kiện hoàn tất response để cập nhật Redis
            res.on('finish', async () => {
                try {
                    // Nếu response là lỗi 5xx Server Error: Xóa lock để cho phép client thử lại
                    if (res.statusCode >= 500) {
                        await redisClient.del(redisKey);
                        return;
                    }

                    // Nếu response thành công hoặc client error (4xx) hợp lệ: Lưu kết quả COMPLETED
                    if (responseBodyCaptured !== null && responseBodyCaptured !== undefined) {
                        const completedPayload: IdempotencyRecord = {
                            status: 'COMPLETED',
                            statusCode: res.statusCode,
                            body: responseBodyCaptured,
                            headers: {
                                'content-type': res.getHeader('content-type') as string || 'application/json'
                            },
                            createdAt: new Date().toISOString()
                        };

                        await redisClient.set(
                            redisKey,
                            JSON.stringify(completedPayload),
                            'EX',
                            responseTtlSeconds
                        );
                    } else {
                        // Trường hợp không có body trả về, xóa lock tránh nghẽn
                        await redisClient.del(redisKey);
                    }
                } catch (cacheErr) {
                    console.error('[IdempotencyMiddleware] Lỗi lưu cache Redis:', cacheErr);
                }
            });

            // 7. Tiếp tục luồng xử lý của Controller / Service
            next();

        } catch (error) {
            console.error('[IdempotencyMiddleware] Lỗi xử lý Redis:', error);
            // Nếu Redis tạm thời sập, fallback cho request tiếp tục thực thi để không chặn business (Fail-open)
            next();
        }
    };
}
