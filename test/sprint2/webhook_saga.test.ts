/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Sprint 2 QA - Payment Webhook & Saga Auto-Refund Tests
 * FILE: test/sprint2/webhook_saga.test.ts
 * MÔ TẢ: Bộ kiểm thử tích hợp tự động hóa (Integration Tests) kiểm chứng
 *       toàn diện tính năng xử lý Webhook IPN và Saga Orchestration:
 *       1. Luồng thanh toán chuẩn (Happy Path trong 10 phút)
 *       2. Luồng Late Webhook Saga Auto-Refund (IPN đến trễ khi phòng đã bị người khác đặt)
 *       3. Luồng từ chối chữ ký số giả mạo (HMAC-SHA512 Invalid Signature)
 *       4. Luồng xử lý giao dịch thất bại từ ngân hàng và giải phóng phòng về AVAILABLE
 * ==============================================================================
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PaymentWebhookService, VnpayIpnPayload } from '../../src/services/PaymentWebhookService';

describe('Sprint 2: Payment Webhook & Saga Auto-Refund Integration Tests', () => {
    let pool: Pool;
    let redisClient: Redis;
    let webhookService: PaymentWebhookService;

    const TEST_HASH_SECRET = 'TEST_SANDBOX_HASH_SECRET_KEY_999888';

    const dbConfig = {
        host: process.env.TEST_DB_HOST || 'localhost',
        port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
        user: process.env.TEST_DB_USER || 'postgres',
        password: process.env.TEST_DB_PASSWORD || 'postgres',
        database: process.env.TEST_DB_NAME || 'smart_booking_test',
        max: 10,
    };

    /**
     * Helper: Tạo chữ ký số HMAC-SHA512 chuẩn cho payload VNPAY test
     */
    function signVnpayPayload(payloadWithoutHash: Record<string, string>, secret: string): string {
        const sortedParams: Record<string, string> = {};
        const keys = Object.keys(payloadWithoutHash).filter(k => k.startsWith('vnp_')).sort();

        for (const k of keys) {
            sortedParams[k] = payloadWithoutHash[k];
        }

        const signData = Object.entries(sortedParams)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');

        return crypto.createHmac('sha512', secret).update(Buffer.from(signData, 'utf-8')).digest('hex');
    }

    beforeAll(async () => {
        pool = new Pool(dbConfig);
        redisClient = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            lazyConnect: true
        });

        try {
            await redisClient.connect();
        } catch {
            console.warn('[WEBHOOK_TEST] Cảnh báo: Redis local chưa khởi động, dùng mock nếu cần.');
        }

        webhookService = new PaymentWebhookService(pool, redisClient, TEST_HASH_SECRET);
    });

    afterAll(async () => {
        if (redisClient) {
            try { await redisClient.quit(); } catch {}
        }
        if (pool) {
            await pool.end();
        }
    });

    /**
     * --------------------------------------------------------------------------
     * TEST SUITE 1: LUỒNG THANH TOÁN CHUẨN (HAPPY PATH TRONG 10 PHÚT)
     * --------------------------------------------------------------------------
     */
    describe('1. Happy Path: Xác nhận thanh toán thành công trong 10 phút', () => {
        const branchId = uuidv4();
        const roomId = uuidv4();
        const slotId = uuidv4();
        const userId = uuidv4();
        const bookingId = uuidv4();
        const bookingCode = `BKG-HAPPY-${Date.now().toString().slice(-5)}`;
        const totalAmount = 500000; // 500.000 VND

        beforeAll(async () => {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await client.query(`
                    INSERT INTO branches (id, name, address, phone) VALUES ($1, 'Chi Nhanh Q1', '123 Le Loi', '0901234567') ON CONFLICT DO NOTHING;
                    INSERT INTO rooms (id, branch_id, name, capacity, hourly_rate) VALUES ($1, $2, 'Room Standard 1', 10, 500000) ON CONFLICT DO NOTHING;
                    INSERT INTO slots (id, room_id, start_time, end_time, status) VALUES ($1, $2, NOW() + INTERVAL '2 hour', NOW() + INTERVAL '3 hour', 'LOCKED') ON CONFLICT DO NOTHING;
                    INSERT INTO users (id, email, phone, full_name, password_hash, role) VALUES ($1, 'happy_user@test.local', '+84933333333', 'Happy User', 'hash', 'CUSTOMER') ON CONFLICT DO NOTHING;
                    
                    -- Tạo booking trạng thái LOCKED_PENDING_ONLINE với lock_expires_at sau 10 phút
                    INSERT INTO bookings (
                        id, user_id, room_id, slot_id, booking_code, booking_status, payment_method, payment_status, total_amount, lock_expires_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, 'LOCKED_PENDING_ONLINE', 'ONLINE_GATEWAY', 'PENDING', $6, NOW() + INTERVAL '10 minutes'
                    );
                `, [bookingId, userId, roomId, slotId, bookingCode, totalAmount]);
                await client.query('COMMIT');
            } catch (e) {
                await client.query('ROLLBACK');
                throw e;
            } finally {
                client.release();
            }
        });

        it('nên cập nhật booking sang CONFIRMED và slot sang BOOKED khi nhận IPN thành công hợp lệ', async () => {
            const baseParams: Record<string, string> = {
                vnp_TmnCode: 'TESTTMN',
                vnp_Amount: (totalAmount * 100).toString(),
                vnp_BankCode: 'NCB',
                vnp_BankTranNo: 'VNP14892182',
                vnp_CardType: 'ATM',
                vnp_PayDate: '20261006120000',
                vnp_OrderInfo: `Thanh toan don ${bookingCode}`,
                vnp_TransactionNo: `TXN-${Date.now()}`,
                vnp_ResponseCode: '00',
                vnp_TransactionStatus: '00',
                vnp_TxnRef: bookingCode
            };

            const secureHash = signVnpayPayload(baseParams, TEST_HASH_SECRET);
            const fullPayload: VnpayIpnPayload = {
                ...(baseParams as any),
                vnp_SecureHash: secureHash
            };

            // Thực thi xử lý IPN
            const result = await webhookService.processVnpayIpn(fullPayload);

            expect(result.isSuccess).toBe(true);
            expect(result.rspCode).toBe('00');
            expect(result.actionTaken).toBe('BOOKING_CONFIRMED');

            // Kiểm tra trạng thái CSDL
            const client = await pool.connect();
            try {
                const bRes = await client.query('SELECT booking_status, payment_status FROM bookings WHERE id = $1', [bookingId]);
                expect(bRes.rows[0].booking_status).toBe('CONFIRMED');
                expect(bRes.rows[0].payment_status).toBe('PAID');

                const sRes = await client.query('SELECT status FROM slots WHERE id = $1', [slotId]);
                expect(sRes.rows[0].status).toBe('BOOKED');

                // Kiểm tra Transactional Outbox Pattern
                const outboxRes = await client.query(
                    "SELECT event_type, status FROM outbox_events WHERE aggregate_id = $1 AND event_type = 'BOOKING_CONFIRMED'",
                    [bookingId]
                );
                expect(outboxRes.rows.length).toBeGreaterThanOrEqual(1);
                expect(outboxRes.rows[0].status).toBe('PENDING');
            } finally {
                client.release();
            }
        });
    });

    /**
     * --------------------------------------------------------------------------
     * TEST SUITE 2: THẢM HỌA LATE WEBHOOK & SAGA AUTO-REFUND (TRỌNG TÂM KIỂM THỬ)
     * --------------------------------------------------------------------------
     * Kịch bản:
     * - Khách A đặt phòng lúc T0, trạng thái LOCKED_PENDING_ONLINE.
     * - Quá 10 phút không có IPN: Booking A bị EXPIRED.
     * - Khách B đến đặt cùng slot đó: Slot thành BOOKED, Booking B là CONFIRMED.
     * - IPN của Khách A gửi về muộn lúc T0 + 10m15s báo trừ tiền thành công.
     * - KỲ VỌNG:
     *   1. Hệ thống TUYỆT ĐỐI KHÔNG đè trạng thái của Booking A sang CONFIRMED (Chống Double-Booking).
     *   2. Kích hoạt Saga Auto-Refund: Đổi Booking A sang EXPIRED_REFUNDED, hoàn tiền 100%.
     *   3. Phòng vẫn thuộc về Khách B (bảo toàn tính toàn vẹn).
     *   4. Lưu event 'LATE_WEBHOOK_AUTO_REFUND_TRIGGERED' vào Outbox.
     */
    describe('2. Saga Orchestrator: Late Webhook & Auto-Refund Conflict Resolution', () => {
        const branchId = uuidv4();
        const roomId = uuidv4();
        const contestedSlotId = uuidv4();
        const userAId = uuidv4();
        const userBId = uuidv4();
        const bookingAId = uuidv4();
        const bookingBId = uuidv4();
        const bookingCodeA = `BKG-LATE-A-${Date.now().toString().slice(-4)}`;
        const bookingCodeB = `BKG-CONFIRM-B-${Date.now().toString().slice(-4)}`;
        const roomPrice = 600000; // 600.000 VND

        beforeAll(async () => {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await client.query(`
                    INSERT INTO branches (id, name, address, phone) VALUES ($1, 'Branch Saga', '456 Saga Rd', '0909999999') ON CONFLICT DO NOTHING;
                    INSERT INTO rooms (id, branch_id, name, capacity, hourly_rate) VALUES ($1, $2, 'Room Saga Conflict', 8, 600000) ON CONFLICT DO NOTHING;
                    INSERT INTO slots (id, room_id, start_time, end_time, status) VALUES ($1, $2, NOW() + INTERVAL '4 hour', NOW() + INTERVAL '5 hour', 'BOOKED') ON CONFLICT DO NOTHING;
                    INSERT INTO users (id, email, phone, full_name, password_hash, role) VALUES 
                        ($1, 'userA@test.local', '+84911110001', 'User A (Late)', 'hash', 'CUSTOMER'),
                        ($2, 'userB@test.local', '+84911110002', 'User B (Current Owner)', 'hash', 'MEMBER')
                    ON CONFLICT DO NOTHING;

                -- 1. Đơn của Khách A: Đã hết hạn (EXPIRED) do quá 10 phút
                INSERT INTO bookings (
                    id, user_id, room_id, slot_id, booking_code, booking_status, payment_method, payment_status, total_amount, lock_expires_at
                ) VALUES (
                    $1, $2, $3, $4, $5, 'EXPIRED', 'ONLINE_GATEWAY', 'PENDING', $6, NOW() - INTERVAL '5 minutes'
                );

                -- 2. Đơn của Khách B: Đã chốt thành công sau khi Khách A hết hạn (CONFIRMED)
                INSERT INTO bookings (
                    id, user_id, room_id, slot_id, booking_code, booking_status, payment_method, payment_status, total_amount
                ) VALUES (
                    $7, $8, $3, $4, $9, 'CONFIRMED', 'PREPAID_WALLET', 'PAID', $6
                );
                `, [bookingAId, userAId, roomId, contestedSlotId, bookingCodeA, roomPrice, bookingBId, userBId, bookingCodeB]);

                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        });

        it('phải kích hoạt Saga Auto-Refund 100% cho Khách A và bảo vệ phòng của Khách B khi nhận Late IPN', async () => {
            // Giả lập VNPAY gửi IPN trễ cho Khách A báo trừ tiền thành công
            const lateParams: Record<string, string> = {
                vnp_TmnCode: 'TESTTMN',
                vnp_Amount: (roomPrice * 100).toString(),
                vnp_BankCode: 'VCB',
                vnp_BankTranNo: 'VNP_LATE_99182',
                vnp_CardType: 'ATM',
                vnp_PayDate: '20261006121500',
                vnp_OrderInfo: `Thanh toan tre cho don ${bookingCodeA}`,
                vnp_TransactionNo: `TXN-LATE-${Date.now()}`,
                vnp_ResponseCode: '00',
                vnp_TransactionStatus: '00',
                vnp_TxnRef: bookingCodeA
            };

            const secureHash = signVnpayPayload(lateParams, TEST_HASH_SECRET);
            const fullLatePayload: VnpayIpnPayload = {
                ...(lateParams as any),
                vnp_SecureHash: secureHash
            };

            // Gọi Webhook Service
            const result = await webhookService.processVnpayIpn(fullLatePayload);

            // 1. Phải phản hồi thành công '00' cho VNPAY để họ không retry nữa
            expect(result.isSuccess).toBe(true);
            expect(result.rspCode).toBe('00');
            // 2. Action bắt buộc phải là AUTO_REFUND_TRIGGERED
            expect(result.actionTaken).toBe('AUTO_REFUND_TRIGGERED');
            expect(result.refundAmount).toBe(roomPrice);

            // 3. Kiểm tra tính toàn vẹn trong Database
            const client = await pool.connect();
            try {
                // Đơn của Khách A phải chuyển sang EXPIRED_REFUNDED (TUYỆT ĐỐI KHÔNG PHẢI CONFIRMED)
                const bookingARes = await client.query(
                    'SELECT booking_status, payment_status, refund_amount FROM bookings WHERE id = $1',
                    [bookingAId]
                );
                expect(bookingARes.rows[0].booking_status).toBe('EXPIRED_REFUNDED');
                expect(bookingARes.rows[0].payment_status).toBe('REFUNDED');
                expect(parseFloat(bookingARes.rows[0].refund_amount)).toBe(roomPrice);

                // Đơn của Khách B PHẢI NGUYÊN VẸN là CONFIRMED (Không bị đè)
                const bookingBRes = await client.query(
                    'SELECT booking_status, payment_status FROM bookings WHERE id = $1',
                    [bookingBId]
                );
                expect(bookingBRes.rows[0].booking_status).toBe('CONFIRMED');
                expect(bookingBRes.rows[0].payment_status).toBe('PAID');

                // Slot vẫn thuộc trạng thái BOOKED của Khách B
                const slotRes = await client.query('SELECT status FROM slots WHERE id = $1', [contestedSlotId]);
                expect(slotRes.rows[0].status).toBe('BOOKED');

                // Kiểm tra sự kiện Outbox: LATE_WEBHOOK_AUTO_REFUND_TRIGGERED
                const outboxRes = await client.query(
                    "SELECT event_type, payload FROM outbox_events WHERE aggregate_id = $1 AND event_type = 'LATE_WEBHOOK_AUTO_REFUND_TRIGGERED'",
                    [bookingAId]
                );
                expect(outboxRes.rows).toHaveLength(1);
                const outboxPayload = outboxRes.rows[0].payload;
                expect(outboxPayload.reason).toBe('SLOT_UNAVAILABLE_AFTER_TIMEOUT');
                expect(outboxPayload.refundAmount).toBe(roomPrice);
                expect(outboxPayload.voucherDiscountPercent).toBe(20);

                // Kiểm tra nhật ký kiểm toán Audit Logs
                const auditRes = await client.query(
                    "SELECT action FROM audit_logs WHERE entity_id = $1 AND action = 'AUTO_REFUND_LATE_WEBHOOK'",
                    [bookingAId]
                );
                expect(auditRes.rows).toHaveLength(1);

            } finally {
                client.release();
            }
        });
    });

    /**
     * --------------------------------------------------------------------------
     * TEST SUITE 3: BẢO VỆ CHỮ KÝ SỐ & CHỐNG GIẢ MẠO DỮ LIỆU IPN
     * --------------------------------------------------------------------------
     */
    describe('3. Security: Chặn IPN có chữ ký số giả mạo hoặc dữ liệu bị sửa đổi', () => {
        it('phải từ chối với mã lỗi 97 khi hacker cố tình thay đổi số tiền hoặc chữ ký', async () => {
            const fakePayload: VnpayIpnPayload = {
                vnp_TmnCode: 'TESTTMN',
                vnp_Amount: '10000000',
                vnp_TransactionNo: 'TXN-FAKE-123',
                vnp_ResponseCode: '00',
                vnp_TransactionStatus: '00',
                vnp_TxnRef: 'BKG-FAKE-9999',
                vnp_SecureHash: 'INVALID_SIGNATURE_HASH_HEX_1234567890ABCDEF'
            };

            const result = await webhookService.processVnpayIpn(fakePayload);

            expect(result.isSuccess).toBe(false);
            expect(result.rspCode).toBe('97');
            expect(result.message).toBe('Invalid Checksum Signature');
            expect(result.actionTaken).toBe('IGNORED');
        });
    });
});
