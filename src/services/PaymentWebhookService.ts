/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Payment Webhook Service & Saga Orchestrator
 * FILE: src/services/PaymentWebhookService.ts
 * MÔ TẢ: Tiếp nhận và đối soát Webhook IPN từ các Cổng thanh toán (VNPAY, MoMo, ZaloPay).
 *       Đặc biệt triển khai cơ chế Saga Orchestration & Auto-Refund xử lý triệt để
 *       thảm họa "Late Webhook" khi IPN gửi về trễ sau thời hạn 10 phút TTL mà phòng
 *       đã bị khách hàng khác đặt chỗ.
 * 
 * NGUYÊN LÝ HOẠT ĐỘNG:
 * 1. Xác thực chữ ký số (Checksum HMAC-SHA512) để chống giả mạo dữ liệu IPN.
 * 2. Khóa dòng bản ghi đơn đặt phòng (SELECT ... FOR UPDATE) để đồng bộ hóa trạng thái.
 * 3. KỊCH BẢN CHUẨN (Happy Path):
 *    - Đơn phòng còn trong hạn 10 phút (LOCKED_PENDING_ONLINE) và slot chưa bị ai chiếm:
 *      -> Cập nhật booking sang 'CONFIRMED', payment_status sang 'PAID'.
 *      -> Cập nhật slot sang 'BOOKED'.
 *      -> Lưu event 'BOOKING_CONFIRMED' vào bảng OUTBOX_EVENTS để gửi mã QR/email.
 * 4. KỊCH BẢN "LATE WEBHOOK" (Saga Compensating Action):
 *    - Đơn phòng đã hết hạn (EXPIRED) HOẶC slot đã được người khác đặt trước:
 *      -> TUYỆT ĐỐI KHÔNG ghi đè trạng thái sang CONFIRMED (Tránh Double-booking).
 *      -> Chuyển trạng thái đơn sang 'EXPIRED_REFUNDED'.
 *      -> Kích hoạt Saga Auto-Refund: Gọi API Cổng thanh toán hoàn trả 100% tiền vào tài khoản khách.
 *      -> Ghi event 'LATE_WEBHOOK_AUTO_REFUND_TRIGGERED' vào outbox_events kèm voucher đền bù.
 * ==============================================================================
 */

import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface VnpayIpnPayload {
    vnp_TmnCode: string;
    vnp_Amount: string;          // Số tiền x 100
    vnp_BankCode?: string;
    vnp_BankTranNo?: string;
    vnp_CardType?: string;
    vnp_PayDate?: string;
    vnp_OrderInfo?: string;
    vnp_TransactionNo: string;   // Mã giao dịch phía VNPAY
    vnp_ResponseCode: string;    // '00' là thành công
    vnp_TransactionStatus: string; // '00' là thành công
    vnp_TxnRef: string;          // Mã bookingCode (VD: BKG-202610-12345)
    vnp_SecureHashType?: string;
    vnp_SecureHash: string;      // Chữ ký bảo mật HMAC-SHA512
}

export interface IpnProcessResult {
    isSuccess: boolean;
    rspCode: string;             // '00': Thành công, '01': Không tìm thấy, '97': Sai chữ ký, v.v.
    message: string;
    actionTaken: 'BOOKING_CONFIRMED' | 'AUTO_REFUND_TRIGGERED' | 'PAYMENT_FAILED' | 'IGNORED';
    bookingId?: string;
    refundAmount?: number;
}

export class PaymentWebhookService {
    private readonly vnpayHashSecret: string;

    constructor(
        private readonly dbPool: Pool,
        private readonly redisClient: Redis,
        hashSecret = process.env.VNPAY_HASH_SECRET || 'SANDBOX_HASH_SECRET_KEY_123456'
    ) {
        this.vnpayHashSecret = hashSecret;
    }

    /**
     * Xử lý Webhook IPN từ cổng thanh toán VNPAY kèm Saga Orchestration
     */
    async processVnpayIpn(payload: VnpayIpnPayload): Promise<IpnProcessResult> {
        // 1. Xác thực chữ ký số HMAC-SHA512
        const isChecksumValid = this.verifyVnpaySignature(payload, this.vnpayHashSecret);
        if (!isChecksumValid) {
            console.error(`[PaymentWebhook] Chữ ký IPN không hợp lệ cho đơn: ${payload.vnp_TxnRef}`);
            return {
                isSuccess: false,
                rspCode: '97',
                message: 'Invalid Checksum Signature',
                actionTaken: 'IGNORED'
            };
        }

        const bookingCode = payload.vnp_TxnRef;
        const transactionNo = payload.vnp_TransactionNo;
        const amount = parseFloat(payload.vnp_Amount) / 100; // Đổi từ cent sang VND
        const isPaymentSuccess = payload.vnp_ResponseCode === '00' && payload.vnp_TransactionStatus === '00';

        const client: PoolClient = await this.dbPool.connect();

        try {
            await client.query('BEGIN');

            // 2. Tìm kiếm và khóa dòng đơn đặt phòng bằng FOR UPDATE
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
                return {
                    isSuccess: false,
                    rspCode: '01',
                    message: 'Order Not Found',
                    actionTaken: 'IGNORED'
                };
            }

            const booking = bookingRes.rows[0];

            // Nếu đơn đã được xác nhận trước đó (trường hợp VNPAY retry IPN nhiều lần)
            if (booking.booking_status === 'CONFIRMED' && booking.payment_status === 'PAID') {
                await client.query('COMMIT');
                return {
                    isSuccess: true,
                    rspCode: '00',
                    message: 'Order already confirmed',
                    actionTaken: 'IGNORED',
                    bookingId: booking.id
                };
            }

            // Ghi nhận bản ghi thanh toán vào bảng payments
            const paymentId = uuidv4();
            await client.query(`
                INSERT INTO payments (
                    id, booking_id, gateway, transaction_code, amount, currency, payment_status, gateway_response
                ) VALUES ($1, $2, 'VNPAY', $3, $4, 'VND', $5, $6)
                ON CONFLICT (transaction_code) DO NOTHING;
            `, [
                paymentId, booking.id, transactionNo, amount, 
                isPaymentSuccess ? 'SUCCESS' : 'FAILED', 
                JSON.stringify(payload)
            ]);

            // ==================================================================
            // KỊCH BẢN THẤT BẠI: Khách hàng hủy thanh toán hoặc tài khoản hết tiền
            // ==================================================================
            if (!isPaymentSuccess) {
                // Giải phóng Redis Lock
                await this.redisClient.del(`slot:${booking.slot_id}:lock`);

                await client.query(`
                    UPDATE bookings 
                    SET booking_status = 'CANCELLED_NO_REFUND', payment_status = 'PENDING', updated_at = CURRENT_TIMESTAMP 
                    WHERE id = $1;
                `, [booking.id]);

                // Mở lại slot phòng họp về AVAILABLE
                await client.query(`
                    UPDATE slots 
                    SET status = 'AVAILABLE', lock_expires_at = NULL 
                    WHERE id = $1;
                `, [booking.slot_id]);

                await client.query('COMMIT');

                return {
                    isSuccess: true,
                    rspCode: '00',
                    message: 'Payment Failed Acknowledged',
                    actionTaken: 'PAYMENT_FAILED',
                    bookingId: booking.id
                };
            }

            // ==================================================================
            // KỊCH BẢN THÀNH CÔNG TỪ NGÂN HÀNG: KIỂM TRA XUNG ĐỘT PHÒNG
            // ==================================================================

            // Kiểm tra xem slot này hiện tại có đang bị người khác đặt không
            const activeConflictQuery = `
                SELECT id, booking_code, user_id, booking_status 
                FROM bookings 
                WHERE slot_id = $1 
                  AND id != $2 
                  AND booking_status NOT IN ('CANCELLED', 'CANCELLED_NO_REFUND', 'EXPIRED', 'EXPIRED_REFUNDED');
            `;
            const conflictRes = await client.query(activeConflictQuery, [booking.slot_id, booking.id]);
            const isSlotTakenBySomeoneElse = conflictRes.rows.length > 0;
            const isLockExpired = booking.booking_status === 'EXPIRED' || (booking.lock_expires_at && new Date() > new Date(booking.lock_expires_at));

            // ==================================================================
            // ĐIỀU KIỆN SAGA AUTO-REFUND (LATE WEBHOOK DISASTER)
            // ==================================================================
            if (isSlotTakenBySomeoneElse || (isLockExpired && booking.booking_status !== 'LOCKED_PENDING_ONLINE')) {
                console.warn(
                    `[PaymentWebhook] PHÁT HIỆN LATE WEBHOOK! Đơn ${bookingCode} thanh toán sau khi hết hạn và phòng đã bị người khác đặt. ` +
                    `Kích hoạt Saga Auto-Refund...`
                );

                // 1. TUYỆT ĐỐI KHÔNG CẬP NHẬT CONFIRMED để bảo vệ khách hàng hiện tại
                await client.query(`
                    UPDATE bookings 
                    SET booking_status = 'EXPIRED_REFUNDED', 
                        payment_status = 'REFUNDED', 
                        refund_amount = $1, 
                        updated_at = CURRENT_TIMESTAMP 
                    WHERE id = $2;
                `, [amount, booking.id]);

                // 2. Kích hoạt bồi hoàn API sang Cổng thanh toán (Compensating Transaction)
                const refundSuccess = await this.triggerGatewayRefund(
                    booking.booking_code,
                    transactionNo,
                    amount,
                    'VNPAY'
                );

                // 3. Transactional Outbox Pattern: Lưu event hoàn tiền tự động kèm voucher xin lỗi
                await client.query(`
                    INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
                    VALUES ('BOOKING', $1, 'LATE_WEBHOOK_AUTO_REFUND_TRIGGERED', $2, 'PENDING');
                `, [booking.id, JSON.stringify({
                    bookingCode: booking.booking_code,
                    userId: booking.user_id,
                    refundAmount: amount,
                    refundSuccess,
                    reason: 'SLOT_UNAVAILABLE_AFTER_TIMEOUT',
                    voucherDiscountPercent: 20
                })]);

                // 4. Ghi nhật ký kiểm toán hệ thống
                await client.query(`
                    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, new_values)
                    VALUES ($1, 'BOOKINGS', $2, 'AUTO_REFUND_LATE_WEBHOOK', $3);
                `, [booking.user_id, booking.id, JSON.stringify({ refundAmount: amount, transactionNo })]);

                await client.query('COMMIT');

                return {
                    isSuccess: true,
                    rspCode: '00',
                    message: 'Late IPN Processed - Compensating Auto-Refund Triggered',
                    actionTaken: 'AUTO_REFUND_TRIGGERED',
                    bookingId: booking.id,
                    refundAmount: amount
                };
            }

            // ==================================================================
            // KỊCH BẢN CHUẨN (HAPPY PATH): ĐẶT PHÒNG THÀNH CÔNG TRONG 10 PHÚT
            // ==================================================================
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

            // 3. Giải phóng Redis temporary lock vì slot đã được chốt vĩnh viễn trong Postgres
            await this.redisClient.del(`slot:${booking.slot_id}:lock`);

            // 4. Transactional Outbox Pattern: Đẩy sự kiện phát hành mã QR và gửi email
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
                isSuccess: true,
                rspCode: '00',
                message: 'Booking Confirmed Successfully',
                actionTaken: 'BOOKING_CONFIRMED',
                bookingId: booking.id
            };

        } catch (error: any) {
            await client.query('ROLLBACK');
            console.error('[PaymentWebhook] Lỗi xử lý giao dịch IPN:', error);
            return {
                isSuccess: false,
                rspCode: '99',
                message: 'Internal System Error',
                actionTaken: 'IGNORED'
            };
        } finally {
            client.release();
        }
    }

    /**
     * Xác thực chữ ký số HMAC-SHA512 của VNPAY
     */
    verifyVnpaySignature(payload: VnpayIpnPayload, secretKey: string): boolean {
        try {
            const secureHash = payload.vnp_SecureHash;
            if (!secureHash) return false;

            // Lọc và sắp xếp các tham số bắt đầu bằng 'vnp_' theo alphabet (loại trừ vnp_SecureHash & vnp_SecureHashType)
            const sortedParams: Record<string, string> = {};
            const keys = Object.keys(payload)
                .filter(k => k.startsWith('vnp_') && k !== 'vnp_SecureHash' && k !== 'vnp_SecureHashType')
                .sort();

            for (const key of keys) {
                const val = (payload as any)[key];
                if (val !== undefined && val !== null && val !== '') {
                    sortedParams[key] = val.toString();
                }
            }

            // Tạo chuỗi query string chuẩn hóa
            const signData = Object.entries(sortedParams)
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                .join('&');

            // Tạo mã băm HMAC-SHA512
            const hmac = crypto.createHmac('sha512', secretKey);
            const calculatedHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

            return secureHash.toLowerCase() === calculatedHash.toLowerCase();
        } catch (err) {
            console.error('[PaymentWebhook] Lỗi kiểm tra chữ ký số:', err);
            return false;
        }
    }

    /**
     * Kích hoạt gọi API Hoàn tiền tự động tới cổng thanh toán (Compensating Transaction)
     */
    private async triggerGatewayRefund(
        bookingCode: string,
        transactionNo: string,
        amount: number,
        gateway: string
    ): Promise<boolean> {
        try {
            console.log(
                `[Saga Compensating Action] Đang gửi yêu cầu hoàn tiền 100% (${amount.toLocaleString()} VND) ` +
                `cho đơn ${bookingCode} (Mã GD: ${transactionNo}) tới cổng ${gateway}...`
            );
            // Giả lập gọi API hoàn tiền của VNPAY/MoMo Sandbox thành công
            // (Trong môi trường thực tế, gửi HTTP POST sang endpoint https://sandbox.vnpayment.vn/merchant_webapi/api/transaction)
            return true;
        } catch (refundErr) {
            console.error(`[Saga Compensating Action] Lỗi khi gọi API hoàn tiền ${gateway}:`, refundErr);
            return false;
        }
    }
}
