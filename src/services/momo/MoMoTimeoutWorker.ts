/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: MoMo Timeout & Fail-Safe Worker (Cronjob)
 * FILE: src/services/momo/MoMoTimeoutWorker.ts
 * MÔ TẢ: Worker chạy định kỳ (5-10 phút/lần) đối soát các giao dịch treo:
 *       1. Quét các đơn LOCKED_PENDING_ONLINE đã quá hạn TTL 10 phút.
 *       2. Gọi Query API sang MoMo để kiểm tra trạng thái thanh toán thực tế.
 *       3. Nếu thất bại/chưa thanh toán: Giải phóng slot về AVAILABLE & xóa Redis lock.
 *       4. Nếu MoMo đã trừ tiền nhưng IPN bị rớt mạng: Chốt đơn an toàn.
 * ==============================================================================
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { MoMoPaymentService } from './MoMoPaymentService';

export interface TimeoutScanResult {
    totalScanned: number;
    expiredAndReleased: number;
    recoveredAndConfirmed: number;
    errors: number;
}

export class MoMoTimeoutWorker {
    private isRunning = false;
    private intervalTimer: NodeJS.Timeout | null = null;

    constructor(
        private readonly dbPool: Pool,
        private readonly redisClient: Redis,
        private readonly momoService: MoMoPaymentService,
        private readonly scanIntervalMs = 5 * 60 * 1000 // 5 phút
    ) {}

    /**
     * Bắt đầu Worker định kỳ
     */
    start(): void {
        if (this.isRunning) {
            console.log('[MoMoTimeoutWorker] Worker đã đang chạy.');
            return;
        }

        this.isRunning = true;
        console.log(`[MoMoTimeoutWorker] Khởi động Fail-safe Worker định kỳ mỗi ${this.scanIntervalMs / 1000}s`);

        // Chạy lần đầu tiên sau 5 giây
        setTimeout(() => this.executeScan(), 5000);

        this.intervalTimer = setInterval(() => {
            this.executeScan();
        }, this.scanIntervalMs);
    }

    /**
     * Dừng Worker
     */
    stop(): void {
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = null;
        }
        this.isRunning = false;
        console.log('[MoMoTimeoutWorker] Đã dừng Fail-safe Worker.');
    }

    /**
     * Thực thi một chu kỳ quét và đối soát (hỗ trợ kiểm thử đơn vị độc lập)
     */
    async executeScan(): Promise<TimeoutScanResult> {
        console.log('[MoMoTimeoutWorker] Bắt đầu quét các đơn đặt phòng online quá thời gian Timeout 10 phút...');

        const result: TimeoutScanResult = {
            totalScanned: 0,
            expiredAndReleased: 0,
            recoveredAndConfirmed: 0,
            errors: 0
        };

        const client = await this.dbPool.connect();

        try {
            // Quét các đơn đang ở trạng thái LOCKED_PENDING_ONLINE mà lock_expires_at < NOW()
            const timedOutQuery = `
                SELECT 
                    b.id, b.booking_code, b.slot_id, b.user_id, b.total_amount,
                    b.lock_expires_at, b.created_at
                FROM bookings b
                WHERE b.booking_status = 'LOCKED_PENDING_ONLINE'
                  AND b.payment_method = 'ONLINE_GATEWAY'
                  AND (b.lock_expires_at < CURRENT_TIMESTAMP OR b.created_at < (CURRENT_TIMESTAMP - INTERVAL '10 minutes'))
                LIMIT 50;
            `;

            const queryRes = await client.query(timedOutQuery);
            result.totalScanned = queryRes.rows.length;

            if (result.totalScanned === 0) {
                console.log('[MoMoTimeoutWorker] Không có đơn hàng nào bị quá hạn. Hệ thống ổn định.');
                return result;
            }

            console.log(`[MoMoTimeoutWorker] Tìm thấy ${result.totalScanned} đơn hàng quá hạn cần đối soát với MoMo.`);

            for (const row of queryRes.rows) {
                const bookingCode = row.booking_code;
                const slotId = row.slot_id;
                const bookingId = row.id;

                try {
                    // Gọi MoMo Query API kiểm tra trạng thái thực tế
                    const queryStatus = await this.momoService.queryPaymentStatus(bookingCode);

                    // Trường hợp 1: MoMo báo khách ĐÃ THANH TOÁN THÀNH CÔNG (resultCode === 0)
                    // nhưng IPN bị rớt trên đường truyền -> Khôi phục giao dịch
                    if (queryStatus.resultCode === 0) {
                        console.log(`[MoMoTimeoutWorker] Khôi phục đơn ${bookingCode}: MoMo xác nhận đã thanh toán thành công.`);
                        await this.momoService.processIpn({
                            partnerCode: queryStatus.partnerCode,
                            orderId: queryStatus.orderId,
                            requestId: queryStatus.requestId,
                            amount: queryStatus.amount,
                            orderInfo: 'Auto-reconciled by Timeout Worker',
                            orderType: 'momo_wallet',
                            transId: queryStatus.transId,
                            resultCode: 0,
                            message: 'Success',
                            payType: queryStatus.payType || 'qr',
                            responseTime: queryStatus.responseTime,
                            extraData: queryStatus.extraData || '',
                            signature: queryStatus.signature || ''
                        });
                        result.recoveredAndConfirmed++;
                    } 
                    // Trường hợp 2: Khách chưa thanh toán hoặc thất bại -> Giải phóng tài nguyên
                    else {
                        console.log(
                            `[MoMoTimeoutWorker] Hủy đơn quá hạn ${bookingCode} (MoMo resultCode: ${queryStatus.resultCode}). ` +
                            `Giải phóng slot ${slotId} về AVAILABLE...`
                        );

                        await client.query('BEGIN');

                        // 1. Cập nhật booking sang EXPIRED
                        await client.query(`
                            UPDATE bookings 
                            SET booking_status = 'EXPIRED', 
                                payment_status = 'UNPAID', 
                                updated_at = CURRENT_TIMESTAMP 
                            WHERE id = $1;
                        `, [bookingId]);

                        // 2. Mở lại slot phòng về AVAILABLE
                        await client.query(`
                            UPDATE slots 
                            SET status = 'AVAILABLE', lock_expires_at = NULL 
                            WHERE id = $1 AND status = 'LOCKED';
                        `, [slotId]);

                        // 3. Xóa Redis Distributed Lock
                        await this.redisClient.del(`slot:${slotId}:lock`);

                        // 4. Đẩy event giải phóng phòng ra outbox
                        await client.query(`
                            INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
                            VALUES ('BOOKING', $1, 'BOOKING_EXPIRED_RELEASED', $2, 'PENDING');
                        `, [bookingId, JSON.stringify({ bookingCode, slotId, reason: 'PAYMENT_TIMEOUT_10M' })]);

                        await client.query('COMMIT');
                        result.expiredAndReleased++;
                    }
                } catch (singleErr) {
                    await client.query('ROLLBACK');
                    console.error(`[MoMoTimeoutWorker] Lỗi xử lý đơn ${bookingCode}:`, singleErr);
                    result.errors++;
                }
            }

            console.log(
                `[MoMoTimeoutWorker] Hoàn tất chu kỳ đối soát: ` +
                `${result.expiredAndReleased} đơn đã giải phóng, ` +
                `${result.recoveredAndConfirmed} đơn khôi phục, ` +
                `${result.errors} lỗi.`
            );

            return result;
        } catch (scanErr) {
            console.error('[MoMoTimeoutWorker] Lỗi tổng quát trong chu kỳ quét:', scanErr);
            result.errors++;
            return result;
        } finally {
            client.release();
        }
    }
}
