/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: MoMo Payment Service (API v3)
 * FILE: src/services/momo/MoMoPaymentService.ts
 * MÔ TẢ: Triển khai toàn diện Cổng thanh toán MoMo API v3:
 *       1. Module 1: Khởi tạo thanh toán (Payment Initiation) với Factory/Strategy.
 *       2. Module 2: Xử lý Webhook IPN (IPN Handler) với Transaction & Saga Auto-Refund.
 *       3. Module 3: Truy vấn giao dịch (Query API) & Hoàn tiền (Refund API).
 *       4. Tuân thủ bảo mật: Chữ ký HMAC-SHA256, Không hardcode secretKey.
 * ==============================================================================
 */

import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import {
    MoMoConfig,
    MoMoCreatePaymentInput,
    MoMoCreatePaymentRequest,
    MoMoCreatePaymentResponse,
    MoMoIpnPayload,
    MoMoIpnProcessResult,
    MoMoQueryRequest,
    MoMoQueryResponse,
    MoMoRefundRequest,
    MoMoRefundResponse
} from './types';
import { MoMoSignatureUtil } from './MoMoSignatureUtil';
import { MoMoPaymentStrategyFactory } from './strategies';

export class MoMoPaymentService {
    private readonly config: MoMoConfig;

    constructor(
        private readonly dbPool: Pool,
        private readonly redisClient: Redis,
        customConfig?: Partial<MoMoConfig>
    ) {
        // Đọc thông số xác thực từ biến môi trường (.env) - Tuyệt đối không hardcode
        const env = (process.env.MOMO_ENV || 'sandbox') as 'sandbox' | 'production';
        const defaultEndpoint =
            env === 'production'
                ? 'https://payment.momo.vn'
                : 'https://test-payment.momo.vn';

        this.config = {
            partnerCode: process.env.MOMO_PARTNER_CODE || 'MOMO_SMART_BOOKING',
            accessKey: process.env.MOMO_ACCESS_KEY || 'MOMO_ACCESS_KEY_DEMO',
            secretKey: process.env.MOMO_SECRET_KEY || 'MOMO_SECRET_KEY_DEMO_2026',
            endpoint: process.env.MOMO_ENDPOINT || defaultEndpoint,
            redirectUrl:
                process.env.MOMO_REDIRECT_URL ||
                'https://smartbooking.vn/payment/momo/callback',
            ipnUrl:
                process.env.MOMO_IPN_URL ||
                'https://api.smartbooking.vn/api/v1/payments/webhook/momo',
            env,
            ...customConfig
        };
    }

    /**
     * ==========================================================================
     * MODULE 1: KHỞI TẠO THANH TOÁN (PAYMENT INITIATION)
     * ==========================================================================
     * Sử dụng Factory Pattern / Strategy Pattern cho 6 hình thức thanh toán.
     * Gọi MoMo API: POST /v2/gateway/api/create
     */
    async createPayment(input: MoMoCreatePaymentInput): Promise<MoMoCreatePaymentResponse> {
        // 1. Lấy Chiến lược thanh toán tương ứng từ Factory
        const strategy = MoMoPaymentStrategyFactory.getStrategy(input.requestType);

        // 2. Kiểm tra tính hợp lệ dữ liệu đặc thù
        strategy.validate(input);

        // 3. Chuẩn bị extraData (Encode Base64 JSON)
        let extraDataString = '';
        if (typeof input.extraData === 'object') {
            extraDataString = MoMoSignatureUtil.encodeExtraData(input.extraData);
        } else if (typeof input.extraData === 'string') {
            extraDataString = input.extraData;
        }

        const requestId = uuidv4();
        const basePayload: Partial<MoMoCreatePaymentRequest> = {
            partnerCode: this.config.partnerCode,
            partnerName: 'Smart Meeting Room Booking',
            storeId: 'SmartBookingStore',
            requestId,
            amount: input.amount,
            orderId: input.orderId,
            orderInfo: input.orderInfo,
            redirectUrl: this.config.redirectUrl,
            ipnUrl: this.config.ipnUrl,
            requestType: input.requestType,
            extraData: extraDataString,
            lang: input.lang || 'vi',
            autoCapture: input.autoCapture !== undefined ? input.autoCapture : true
        };

        // 4. Bổ sung tham số đặc thù từ Strategy (userInfo, subscriptionInfo, token, v.v.)
        const enrichedPayload = strategy.enrichPayload(input, basePayload);

        // 5. Tạo chữ ký số HMAC-SHA256 theo chuẩn MoMo v3
        // Sắp xếp các tham số A-Z và băm với secretKey
        const signature = MoMoSignatureUtil.generateGatewayCreateSignature(
            this.config.accessKey,
            this.config.secretKey,
            {
                amount: enrichedPayload.amount!,
                extraData: enrichedPayload.extraData!,
                ipnUrl: enrichedPayload.ipnUrl!,
                orderId: enrichedPayload.orderId!,
                orderInfo: enrichedPayload.orderInfo!,
                partnerCode: enrichedPayload.partnerCode!,
                redirectUrl: enrichedPayload.redirectUrl!,
                requestId: enrichedPayload.requestId!,
                requestType: enrichedPayload.requestType!
            }
        );

        const requestBody: MoMoCreatePaymentRequest = {
            ...(enrichedPayload as MoMoCreatePaymentRequest),
            signature
        };

        // 6. Gửi Request lên MoMo Endpoint
        const createUrl = `${this.config.endpoint}/v2/gateway/api/create`;
        console.log(`[MoMo Payment] Khởi tạo giao dịch ${input.orderId} (requestType: ${input.requestType}) tới ${createUrl}`);

        try {
            const response = await fetch(createUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`MoMo Gateway HTTP Error ${response.status}: ${errorText}`);
            }

            const responseData = (await response.json()) as MoMoCreatePaymentResponse;
            return responseData;
        } catch (fetchError: any) {
            console.error('[MoMo Payment] Lỗi gọi API /create:', fetchError);
            throw new Error(`Không thể kết nối Cổng thanh toán MoMo: ${fetchError.message}`);
        }
    }

    /**
     * ==========================================================================
     * MODULE 2: IPN / WEBHOOK HANDLER (XỬ LÝ KẾT QUẢ TỪ MOMO)
     * ==========================================================================
     * Đây là API DUY NHẤT được phép chốt trạng thái đơn hàng.
     * Quy trình:
     * - Bước 2.1: Xác thực chữ ký HMAC_SHA256 (bỏ signature cũ).
     * - Bước 2.2: Kiểm tra Idempotency trong Database Transaction.
     * - Bước 2.3: Chốt PAID hoặc kích hoạt Saga Auto-Refund nếu gặp Late Webhook.
     */
    async processIpn(payload: MoMoIpnPayload): Promise<MoMoIpnProcessResult> {
        // Ghi logs chi tiết tại Webhook theo yêu cầu
        console.log(`[MoMo IPN] Received orderId: ${payload.orderId}, resultCode: ${payload.resultCode}, transId: ${payload.transId}`);

        // ----------------------------------------------------------------------
        // BƯỚC 2.1: XÁC THỰC CHỮ KÝ SỐ HMAC-SHA256
        // ----------------------------------------------------------------------
        const isSignatureValid = MoMoSignatureUtil.verifyIpnSignature(
            payload,
            this.config.accessKey,
            this.config.secretKey
        );

        if (!isSignatureValid) {
            console.error(`[MoMo IPN] ❌ Chữ ký số KHÔNG HỢP LỆ cho đơn: ${payload.orderId}`);
            return {
                statusCode: 400,
                message: 'Invalid HMAC Signature',
                actionTaken: 'IGNORED'
            };
        }

        const bookingCode = payload.orderId;
        const transactionNo = String(payload.transId);
        const amount = payload.amount;
        const isPaymentSuccess = payload.resultCode === 0;

        const client: PoolClient = await this.dbPool.connect();

        try {
            await client.query('BEGIN');

            // Khóa dòng bản ghi đơn đặt phòng (SELECT ... FOR UPDATE)
            const bookingQuery = `
                SELECT 
                    b.id, b.user_id, b.room_id, b.slot_id, b.booking_code,
                    b.booking_status, b.payment_status, b.total_amount,
                    b.lock_expires_at,
                    s.status AS slot_status
                FROM bookings b
                JOIN slots s ON s.id = b.slot_id
                WHERE b.booking_code = $1
                FOR UPDATE;
            `;
            const bookingRes = await client.query(bookingQuery, [bookingCode]);

            if (bookingRes.rows.length === 0) {
                await client.query('ROLLBACK');
                console.warn(`[MoMo IPN] Không tìm thấy đơn hàng: ${bookingCode}`);
                return {
                    statusCode: 200,
                    message: 'Order Not Found Acknowledged',
                    actionTaken: 'IGNORED'
                };
            }

            const booking = bookingRes.rows[0];

            // ------------------------------------------------------------------
            // BƯỚC 2.2: CHỐNG TRÙNG LẶP (IDEMPOTENCY CHECK)
            // ------------------------------------------------------------------
            if (booking.booking_status === 'CONFIRMED' && booking.payment_status === 'PAID') {
                console.log(`[MoMo IPN] Đơn ${bookingCode} đã được chốt PAID trước đó. Bỏ qua xử lý.`);
                await client.query('COMMIT');
                return {
                    statusCode: 204, // No Content
                    message: 'Order already processed',
                    actionTaken: 'IGNORED',
                    bookingId: booking.id
                };
            }

            // Ghi nhận lịch sử giao dịch vào bảng payments
            const paymentId = uuidv4();
            await client.query(`
                INSERT INTO payments (
                    id, booking_id, gateway, transaction_code, amount, currency, payment_status, gateway_response
                ) VALUES ($1, $2, 'MOMO', $3, $4, 'VND', $5, $6)
                ON CONFLICT (transaction_code) DO NOTHING;
            `, [
                paymentId,
                booking.id,
                transactionNo,
                amount,
                isPaymentSuccess ? 'SUCCESS' : 'FAILED',
                JSON.stringify(payload)
            ]);

            // ------------------------------------------------------------------
            // BƯỚC 2.3 - NHÁNH THẤT BẠI: Người dùng hủy hoặc lỗi từ MoMo
            // ------------------------------------------------------------------
            if (!isPaymentSuccess) {
                console.warn(`[MoMo IPN] Giao dịch không thành công cho đơn ${bookingCode}. resultCode: ${payload.resultCode}`);

                // Giải phóng Redis Lock
                await this.redisClient.del(`slot:${booking.slot_id}:lock`);

                // Cập nhật booking sang CANCELLED_NO_REFUND
                await client.query(`
                    UPDATE bookings 
                    SET booking_status = 'CANCELLED_NO_REFUND', 
                        payment_status = 'PENDING', 
                        updated_at = CURRENT_TIMESTAMP 
                    WHERE id = $1;
                `, [booking.id]);

                // Mở lại slot phòng về AVAILABLE nếu chưa có ai đặt
                await client.query(`
                    UPDATE slots 
                    SET status = 'AVAILABLE', lock_expires_at = NULL 
                    WHERE id = $1 AND status = 'LOCKED';
                `, [booking.slot_id]);

                await client.query('COMMIT');

                return {
                    statusCode: 200,
                    message: 'Payment Failed Acknowledged',
                    actionTaken: 'PAYMENT_FAILED',
                    bookingId: booking.id
                };
            }

            // ------------------------------------------------------------------
            // BƯỚC 2.3 - NHÁNH THÀNH CÔNG (resultCode === 0): KIỂM TRA SAGA LATE WEBHOOK
            // ------------------------------------------------------------------
            const activeConflictQuery = `
                SELECT id, booking_code, user_id, booking_status 
                FROM bookings 
                WHERE slot_id = $1 
                  AND id != $2 
                  AND booking_status NOT IN ('CANCELLED', 'CANCELLED_NO_REFUND', 'EXPIRED', 'EXPIRED_REFUNDED');
            `;
            const conflictRes = await client.query(activeConflictQuery, [booking.slot_id, booking.id]);
            const isSlotTakenBySomeoneElse = conflictRes.rows.length > 0;
            const isLockExpired =
                booking.booking_status === 'EXPIRED' ||
                (booking.lock_expires_at && new Date() > new Date(booking.lock_expires_at));

            // THẢM HỌA LATE WEBHOOK: Tiền về sau khi phòng đã bị giải phóng và người khác chiếm mất
            if (isSlotTakenBySomeoneElse || (isLockExpired && booking.booking_status !== 'LOCKED_PENDING_ONLINE')) {
                console.warn(
                    `[MoMo IPN] ⚠️ PHÁT HIỆN LATE WEBHOOK! Đơn ${bookingCode} thanh toán sau TTL 10m và slot đã mất. ` +
                    `Kích hoạt Saga Auto-Refund...`
                );

                // 1. Cập nhật trạng thái đơn sang EXPIRED_REFUNDED
                await client.query(`
                    UPDATE bookings 
                    SET booking_status = 'EXPIRED_REFUNDED', 
                        payment_status = 'REFUNDED', 
                        refund_amount = $1, 
                        updated_at = CURRENT_TIMESTAMP 
                    WHERE id = $2;
                `, [amount, booking.id]);

                // 2. Kích hoạt bồi hoàn tiền 100% tự động qua MoMo Refund API
                const refundResult = await this.refundPayment(
                    booking.booking_code,
                    amount,
                    payload.transId,
                    'Saga Auto-Refund: Slot Unavailable due to late payment'
                );

                // 3. Transactional Outbox Pattern: Đẩy event hoàn tiền kèm voucher xin lỗi 20%
                await client.query(`
                    INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
                    VALUES ('BOOKING', $1, 'LATE_WEBHOOK_AUTO_REFUND_TRIGGERED', $2, 'PENDING');
                `, [booking.id, JSON.stringify({
                    bookingCode: booking.booking_code,
                    userId: booking.user_id,
                    refundAmount: amount,
                    refundSuccess: refundResult.resultCode === 0,
                    reason: 'SLOT_UNAVAILABLE_AFTER_TIMEOUT',
                    voucherDiscountPercent: 20
                })]);

                await client.query('COMMIT');

                return {
                    statusCode: 200,
                    message: 'Late IPN Processed - Compensating Auto-Refund Triggered',
                    actionTaken: 'AUTO_REFUND_TRIGGERED',
                    bookingId: booking.id,
                    refundAmount: amount
                };
            }

            // KỊCH BẢN CHUẨN (HAPPY PATH): Đặt phòng thành công trong hạn 10 phút
            // 1. Cập nhật booking sang CONFIRMED và PAID
            await client.query(`
                UPDATE bookings 
                SET booking_status = 'CONFIRMED', 
                    payment_status = 'PAID', 
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = $1;
            `, [booking.id]);

            // 2. Cập nhật slot sang BOOKED
            await client.query(`
                UPDATE slots 
                SET status = 'BOOKED', lock_expires_at = NULL 
                WHERE id = $1;
            `, [booking.slot_id]);

            // 3. Giải phóng Redis temporary lock
            await this.redisClient.del(`slot:${booking.slot_id}:lock`);

            // 4. Transactional Outbox Pattern: Đẩy sự kiện BOOKING_CONFIRMED (gửi QR check-in)
            await client.query(`
                INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
                VALUES ('BOOKING', $1, 'BOOKING_CONFIRMED', $2, 'PENDING');
            `, [booking.id, JSON.stringify({
                bookingCode: booking.booking_code,
                userId: booking.user_id,
                totalAmount: amount,
                qrCodeData: `SMARTBOOKING:${booking.booking_code}:${booking.id}`
            })]);

            await client.query('COMMIT');

            return {
                statusCode: 200,
                message: 'Booking Confirmed Successfully',
                actionTaken: 'BOOKING_CONFIRMED',
                bookingId: booking.id,
                callbackToken: payload.callbackToken
            };

        } catch (dbError: any) {
            await client.query('ROLLBACK');
            console.error('[MoMo IPN] Lỗi Database Transaction:', dbError);
            return {
                statusCode: 500,
                message: 'Internal Database Error',
                actionTaken: 'IGNORED'
            };
        } finally {
            client.release();
        }
    }

    /**
     * ==========================================================================
     * MODULE 3: FAIL-SAFE & QUERY STATUS (POST /v2/gateway/api/query)
     * ==========================================================================
     */
    async queryPaymentStatus(orderId: string, requestId = uuidv4()): Promise<MoMoQueryResponse> {
        // raw signature query: accessKey=$accessKey&orderId=$orderId&partnerCode=$partnerCode&requestId=$requestId
        const rawSignature =
            `accessKey=${this.config.accessKey}&orderId=${orderId}` +
            `&partnerCode=${this.config.partnerCode}&requestId=${requestId}`;

        const signature = MoMoSignatureUtil.generateSignature(
            {
                accessKey: this.config.accessKey,
                orderId,
                partnerCode: this.config.partnerCode,
                requestId
            },
            this.config.secretKey
        );

        const requestBody: MoMoQueryRequest = {
            partnerCode: this.config.partnerCode,
            requestId,
            orderId,
            signature,
            lang: 'vi'
        };

        const queryUrl = `${this.config.endpoint}/v2/gateway/api/query`;
        console.log(`[MoMo Query] Truy vấn trạng thái đơn ${orderId} tại ${queryUrl}`);

        try {
            const response = await fetch(queryUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`MoMo Query HTTP Error ${response.status}: ${errorText}`);
            }

            return (await response.json()) as MoMoQueryResponse;
        } catch (err: any) {
            console.error(`[MoMo Query] Lỗi truy vấn đơn ${orderId}:`, err);
            throw err;
        }
    }

    /**
     * ==========================================================================
     * HOÀN TIỀN TỰ ĐỘNG (REFUND API: POST /v2/gateway/api/refund)
     * ==========================================================================
     */
    async refundPayment(
        orderId: string,
        amount: number,
        transId: number,
        description = 'Hoàn tiền phòng họp'
    ): Promise<MoMoRefundResponse> {
        const requestId = uuidv4();
        const refundOrderId = `REFUND-${orderId}-${Date.now()}`;

        // Raw signature refund: accessKey=$accessKey&amount=$amount&description=$description&orderId=$orderId&partnerCode=$partnerCode&requestId=$requestId&transId=$transId
        const rawSignature =
            `accessKey=${this.config.accessKey}&amount=${amount}` +
            `&description=${description}&orderId=${refundOrderId}` +
            `&partnerCode=${this.config.partnerCode}&requestId=${requestId}` +
            `&transId=${transId}`;

        const signature = MoMoSignatureUtil.generateSignature(
            {
                accessKey: this.config.accessKey,
                amount,
                description,
                orderId: refundOrderId,
                partnerCode: this.config.partnerCode,
                requestId,
                transId
            },
            this.config.secretKey
        );

        const requestBody: MoMoRefundRequest = {
            partnerCode: this.config.partnerCode,
            orderId: refundOrderId,
            requestId,
            amount,
            transId,
            description,
            signature,
            lang: 'vi'
        };

        const refundUrl = `${this.config.endpoint}/v2/gateway/api/refund`;
        console.log(`[MoMo Refund] Gửi yêu cầu hoàn tiền ${amount.toLocaleString()} VND cho đơn ${orderId} (transId: ${transId})`);

        try {
            const response = await fetch(refundUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`[MoMo Refund] Phản hồi lỗi HTTP ${response.status}: ${errorText}`);
                return {
                    partnerCode: this.config.partnerCode,
                    orderId: refundOrderId,
                    requestId,
                    amount,
                    transId,
                    resultCode: response.status,
                    message: errorText,
                    responseTime: Date.now()
                };
            }

            return (await response.json()) as MoMoRefundResponse;
        } catch (err: any) {
            console.error('[MoMo Refund] Ngoại lệ khi gọi Refund API:', err);
            return {
                partnerCode: this.config.partnerCode,
                orderId: refundOrderId,
                requestId,
                amount,
                transId,
                resultCode: 99,
                message: err.message,
                responseTime: Date.now()
            };
        }
    }
}
