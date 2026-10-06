/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Sprint 1 QA - Database Concurrency & Lock Resilience Tests
 * FILE: test/sprint1/db_locks.test.ts
 * MÔ TẢ: Bộ kiểm thử tự động hóa (Automated Integration / Concurrency Tests)
 *       mô phỏng các cuộc tấn công đồng thời (Race Condition), tấn công tiêu âm
 *       tiền ví (Double-Spending), và kiểm chứng tính toàn vẹn của:
 *       1. Pessimistic Locking (`SELECT ... FOR UPDATE`) & Function `deduct_member_wallet`
 *       2. Ràng buộc CSDL `chk_wallet_non_negative` (Số dư tuyệt đối không âm)
 *       3. Partial Unique Index `idx_unique_active_meeting_slot` (Chống Double-Booking)
 *       4. Kiểm soát Hạn mức Tín dụng Công nợ `chk_company_credit_limit`
 *       5. Tính nguyên tử của Transactional Outbox Pattern (`outbox_events`)
 * ==============================================================================
 */

import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

describe('Sprint 1: Database Locks, Concurrency & Resiliency Engine Tests', () => {
    let pool: Pool;

    // Các biến môi trường test CSDL (mặc định trỏ tới Postgres test instance)
    const dbConfig = {
        host: process.env.TEST_DB_HOST || 'localhost',
        port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
        user: process.env.TEST_DB_USER || 'postgres',
        password: process.env.TEST_DB_PASSWORD || 'postgres',
        database: process.env.TEST_DB_NAME || 'smart_booking_test',
        max: 20, // Cho phép tối thiểu 20 client kết nối đồng thời để mô phỏng tải
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    };

    beforeAll(async () => {
        pool = new Pool(dbConfig);
        // Kiểm tra kết nối CSDL trước khi chạy test suite
        try {
            const client = await pool.connect();
            await client.query('SELECT 1');
            client.release();
        } catch (err) {
            console.warn('[DB_LOCKS_TEST] Cảnh báo: Không thể kết nối trực tiếp CSDL PostgreSQL test. ' +
                'Kiểm tra cấu hình TEST_DB_* nếu muốn chạy tích hợp thực tế.');
        }
    });

    afterAll(async () => {
        if (pool) {
            await pool.end();
        }
    });

    /**
     * --------------------------------------------------------------------------
     * TEST SUITE 1: TẤN CÔNG TIÊU ÂM TIỀN VÍ THÀNH VIÊN (DOUBLE-SPENDING ATTACK)
     * --------------------------------------------------------------------------
     * Kịch bản:
     * - Thành viên A có số dư 400.000 VND.
     * - Gửi đồng thời 2 giao dịch trừ 350.000 VND (tổng 700.000 VND) trong cùng 1 thời điểm.
     * - Kỳ vọng: Đúng 1 giao dịch thành công; giao dịch thứ 2 bị từ chối; số dư cuối cùng
     *   chính xác là 50.000 VND; không bao giờ bị âm.
     */
    describe('1. Member Wallet Concurrency & Anti Double-Spending', () => {
        const testUserId = uuidv4();
        const testWalletId = uuidv4();
        const initialBalance = 400000.00; // 400.000 VND
        const chargeAmount = 350000.00;   // 350.000 VND mỗi đơn

        beforeEach(async () => {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                // Tạo người dùng test
                await client.query(`
                    INSERT INTO users (id, email, phone, full_name, password_hash, role)
                    VALUES ($1, $2, $3, 'Test Member', 'hash123', 'MEMBER')
                    ON CONFLICT (id) DO NOTHING;
                `, [testUserId, `member_${testUserId}@test.local`, `+849${Date.now().toString().slice(-8)}`]);

                // Khởi tạo ví với 400.000 VND
                await client.query(`
                    INSERT INTO member_wallets (id, user_id, balance, currency)
                    VALUES ($1, $2, $3, 'VND')
                    ON CONFLICT (user_id) DO UPDATE SET balance = $3;
                `, [testWalletId, testUserId, initialBalance]);

                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        });

        it('nên khóa dòng dữ liệu (Pessimistic Lock) và chỉ cho phép 1 giao dịch thành công khi gửi 2 request song song', async () => {
            const bookingId1 = uuidv4();
            const bookingId2 = uuidv4();
            const idempotencyKey1 = uuidv4();
            const idempotencyKey2 = uuidv4();

            // Hàm thực thi gọi Stored Function deduct_member_wallet trên 1 kết nối độc lập
            const executeDeduct = async (bookingId: string, idempKey: string) => {
                const client = await pool.connect();
                try {
                    const res = await client.query(`
                        SELECT * FROM deduct_member_wallet($1, $2, $3, $4, $5);
                    `, [testUserId, chargeAmount, bookingId, idempKey, 'Đặt phòng họp test']);
                    return res.rows[0];
                } finally {
                    client.release();
                }
            };

            // BẮN 2 REQUEST ĐỒNG THỜI (PARALLEL PROMISE.ALL)
            const results = await Promise.all([
                executeDeduct(bookingId1, idempotencyKey1),
                executeDeduct(bookingId2, idempotencyKey2)
            ]);

            const successfulTx = results.filter(r => r.success === true);
            const failedTx = results.filter(r => r.success === false);

            // 1. Chỉ duy nhất 1 giao dịch thành công
            expect(successfulTx).toHaveLength(1);
            expect(failedTx).toHaveLength(1);

            // 2. Giao dịch thất bại phải có lý do 'INSUFFICIENT_FUNDS'
            expect(failedTx[0].error_message).toBe('INSUFFICIENT_FUNDS');

            // 3. Kiểm tra số dư thực tế trong CSDL sau khi cạnh tranh hoàn tất
            const client = await pool.connect();
            try {
                const walletRes = await client.query(
                    'SELECT balance FROM member_wallets WHERE id = $1',
                    [testWalletId]
                );
                const finalBalance = parseFloat(walletRes.rows[0].balance);

                // Số dư phải còn đúng 50.000 VND (400k - 350k = 50k)
                expect(finalBalance).toBe(50000.00);

                // 4. Kiểm tra lịch sử giao dịch ví chỉ có đúng 1 bản ghi
                const txRes = await client.query(
                    'SELECT * FROM wallet_transactions WHERE wallet_id = $1',
                    [testWalletId]
                );
                expect(txRes.rows).toHaveLength(1);
                expect(txRes.rows[0].transaction_type).toBe('DEBIT_BOOKING');
                expect(parseFloat(txRes.rows[0].amount)).toBe(chargeAmount);
            } finally {
                client.release();
            }
        });

        it('phải chặn hoàn toàn nếu cố tình trừ tiền vượt số dư nhờ ràng buộc chk_wallet_non_negative', async () => {
            const client = await pool.connect();
            try {
                // Cố tình chạy lệnh UPDATE thủ công làm số dư âm
                await expect(
                    client.query(
                        'UPDATE member_wallets SET balance = balance - 500000 WHERE id = $1',
                        [testWalletId]
                    )
                ).rejects.toThrow(/chk_wallet_non_negative/);
            } finally {
                client.release();
            }
        });
    });

    /**
     * --------------------------------------------------------------------------
     * TEST SUITE 2: PARTIAL UNIQUE INDEX CHỐNG DOUBLE-BOOKING CẤP CSDL
     * --------------------------------------------------------------------------
     * Kịch bản:
     * - 2 giao dịch đồng thời cố gắng tạo Booking cho cùng 1 `slot_id`.
     * - Kỳ vọng: Booking 1 thành công; Booking 2 văng lỗi vi phạm Unique Constraint (mã lỗi Postgres 23505).
     * - Khi Booking 1 chuyển sang 'CANCELLED' hoặc 'EXPIRED', Slot đó phải cho phép đặt lại.
     */
    describe('2. Partial Unique Index Double-Booking Prevention', () => {
        const branchId = uuidv4();
        const roomId = uuidv4();
        const slotId = uuidv4();
        const user1Id = uuidv4();
        const user2Id = uuidv4();

        beforeAll(async () => {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                // Tạo branch & room & slot
                await client.query(`
                    INSERT INTO branches (id, name, address, phone)
                    VALUES ($1, 'Branch Test', '123 Test St', '0123456789')
                    ON CONFLICT DO NOTHING;
                `, [branchId]);

                await client.query(`
                    INSERT INTO rooms (id, branch_id, name, room_type, capacity, hourly_rate)
                    VALUES ($1, $2, 'Room Lock Test', 'STANDARD', 6, 200000)
                    ON CONFLICT DO NOTHING;
                `, [roomId, branchId]);

                await client.query(`
                    INSERT INTO slots (id, room_id, start_time, end_time, status)
                    VALUES ($1, $2, NOW() + INTERVAL '1 hour', NOW() + INTERVAL '2 hour', 'AVAILABLE')
                    ON CONFLICT DO NOTHING;
                `, [slotId, roomId]);

                // Tạo 2 user
                await client.query(`
                    INSERT INTO users (id, email, phone, full_name, password_hash, role)
                    VALUES 
                        ($1, 'user1@test.local', '+84911111111', 'User One', 'hash', 'CUSTOMER'),
                        ($2, 'user2@test.local', '+84922222222', 'User Two', 'hash', 'CUSTOMER')
                    ON CONFLICT DO NOTHING;
                `, [user1Id, user2Id]);

                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        });

        it('nên ném lỗi Postgres 23505 (unique_violation) khi 2 đơn đặt cùng 1 slot đang hoạt động', async () => {
            const client1 = await pool.connect();
            const client2 = await pool.connect();

            try {
                // Khách 1 đặt thành công
                await client1.query(`
                    INSERT INTO bookings (
                        id, user_id, room_id, slot_id, booking_code, 
                        booking_status, payment_method, total_amount
                    ) VALUES (
                        $1, $2, $3, $4, 'BKG-TEST-001', 
                        'LOCKED_PENDING_ONLINE', 'ONLINE_GATEWAY', 200000
                    );
                `, [uuidv4(), user1Id, roomId, slotId]);

                // Khách 2 cố tình đặt cùng slotId -> Phải văng lỗi vi phạm Unique Constraint
                let errorCaught: any = null;
                try {
                    await client2.query(`
                        INSERT INTO bookings (
                            id, user_id, room_id, slot_id, booking_code, 
                            booking_status, payment_method, total_amount
                        ) VALUES (
                            $1, $2, $3, $4, 'BKG-TEST-002', 
                            'LOCKED_PENDING_ONLINE', 'ONLINE_GATEWAY', 200000
                        );
                    `, [uuidv4(), user2Id, roomId, slotId]);
                } catch (err) {
                    errorCaught = err;
                }

                expect(errorCaught).toBeDefined();
                // Mã lỗi 23505 đại diện cho Unique Violation trong PostgreSQL
                expect(errorCaught.code).toBe('23505');
                expect(errorCaught.message).toMatch(/idx_unique_active_meeting_slot/);

            } finally {
                client1.release();
                client2.release();
            }
        });

        it('cho phép tạo booking mới cho slot đó sau khi đơn trước chuyển sang CANCELLED hoặc EXPIRED', async () => {
            const client = await pool.connect();
            try {
                // Đổi trạng thái booking của Khách 1 sang CANCELLED
                await client.query(`
                    UPDATE bookings 
                    SET booking_status = 'CANCELLED' 
                    WHERE booking_code = 'BKG-TEST-001';
                `);

                // Bây giờ Khách 2 đặt lại cùng slotId -> Phải thành công!
                const newBookingId = uuidv4();
                const res = await client.query(`
                    INSERT INTO bookings (
                        id, user_id, room_id, slot_id, booking_code, 
                        booking_status, payment_method, total_amount
                    ) VALUES (
                        $1, $2, $3, $4, 'BKG-TEST-REBOOK', 
                        'CONFIRMED', 'ONLINE_GATEWAY', 200000
                    ) RETURNING id, booking_status;
                `, [newBookingId, user2Id, roomId, slotId]);

                expect(res.rows[0].id).toBe(newBookingId);
                expect(res.rows[0].booking_status).toBe('CONFIRMED');
            } finally {
                client.release();
            }
        });
    });

    /**
     * --------------------------------------------------------------------------
     * TEST SUITE 3: KIỂM SOÁT HẠN MỨC CÔNG NỢ (CREDIT LIMIT ENFORCEMENT)
     * --------------------------------------------------------------------------
     * Kịch bản:
     * - Doanh nghiệp có credit_limit = 10.000.000 VND, current_debt = 9.500.000 VND.
     * - Cố tình cập nhật công nợ thêm 1.000.000 VND (tổng 10.5M > 10M).
     * - Kỳ vọng: Bị từ chối bởi ràng buộc `chk_company_credit_limit`.
     */
    describe('3. Corporate Credit Limit Constraint', () => {
        const companyId = uuidv4();

        beforeAll(async () => {
            const client = await pool.connect();
            try {
                await client.query(`
                    INSERT INTO companies (id, name, tax_code, credit_limit, current_debt)
                    VALUES ($1, 'Limit Test Corp', '0999999999', 10000000.00, 9500000.00)
                    ON CONFLICT DO NOTHING;
                `, [companyId]);
            } finally {
                client.release();
            }
        });

        it('phải chặn giao dịch công nợ nếu current_debt vượt quá credit_limit', async () => {
            const client = await pool.connect();
            try {
                // Cố tình tăng nợ vượt hạn mức 10 triệu
                await expect(
                    client.query(
                        'UPDATE companies SET current_debt = current_debt + 1000000 WHERE id = $1',
                        [companyId]
                    )
                ).rejects.toThrow(/chk_company_credit_limit/);

                // Kiểm tra dư nợ vẫn an toàn ở mức 9.500.000 VND
                const res = await client.query('SELECT current_debt FROM companies WHERE id = $1', [companyId]);
                expect(parseFloat(res.rows[0].current_debt)).toBe(9500000.00);
            } finally {
                client.release();
            }
        });
    });

    /**
     * --------------------------------------------------------------------------
     * TEST SUITE 4: TÍNH NGUYÊN TỬ CỦA TRANSACTIONAL OUTBOX PATTERN
     * --------------------------------------------------------------------------
     * Kịch bản:
     * - Lưu Booking và sự kiện OUTBOX_EVENTS trong cùng 1 transaction DB.
     * - Khi có lỗi phát sinh giữa chừng (Rollback), cả 2 bản ghi đều không được lưu (Zero Orphan Records).
     */
    describe('4. Transactional Outbox Pattern Atomicity', () => {
        it('phải rollback cả booking và outbox_events khi có sự cố, không để lại bản ghi rác', async () => {
            const client = await pool.connect();
            const orphanBookingId = uuidv4();
            const orphanEventId = uuidv4();

            try {
                await client.query('BEGIN');

                // 1. Chèn outbox event
                await client.query(`
                    INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status)
                    VALUES ($1, 'BOOKING', $2, 'BOOKING_CREATED', '{"test": true}', 'PENDING');
                `, [orphanEventId, orphanBookingId]);

                // 2. Cố tình gây lỗi cú pháp hoặc vi phạm khóa ngoại để ép ROLLBACK
                await client.query(`
                    INSERT INTO bookings (id, user_id, room_id, slot_id, booking_code, total_amount, payment_method)
                    VALUES ($1, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'FAIL-CODE', -100, 'ONLINE_GATEWAY');
                `, [orphanBookingId]);

                await client.query('COMMIT');
            } catch (expectedErr) {
                await client.query('ROLLBACK');
            } finally {
                client.release();
            }

            // Kiểm tra: Bảng outbox_events TUYỆT ĐỐI không được tồn tại orphanEventId
            const checkClient = await pool.connect();
            try {
                const res = await checkClient.query(
                    'SELECT 1 FROM outbox_events WHERE id = $1',
                    [orphanEventId]
                );
                expect(res.rows).toHaveLength(0);
            } finally {
                checkClient.release();
            }
        });
    });
});
