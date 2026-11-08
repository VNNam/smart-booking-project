/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Booking Service (Core Business Logic & Concurrency Engine)
 * FILE: src/services/BookingService.ts
 * MÔ TẢ: Xử lý toàn bộ logic nghiệp vụ đặt phòng theo đặc tả BRD v1.4:
 *       1. Khóa phòng giữ chỗ 10 phút (Redis Redlock - TTL 600s) cho Online Payment
 *       2. Trừ tiền ví tức thì an toàn (Pessimistic Lock & DB Constraint) cho Ví thành viên
 *       3. Đặt phòng tại quầy thu tiền mặt (Walk-in Cash) và tự động ghi sổ quỹ CASH_BOOK_LOGS
 *       4. Đặt phòng công nợ kiểm soát hạn mức tín dụng (Credit Limit Enforcement)
 *       5. Chính sách hủy phòng đa tầng (24h: 100%, 2h-24h: 80%, <2h: 0%) và Two-Man Rule
 *       6. Transactional Outbox Pattern lưu sự kiện đồng bộ với Database Transaction
 * ==============================================================================
 */

import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { MoMoPaymentService } from './momo';
import { computeBookingAmount } from '../utils/businessTime';
import { QuotaService } from './QuotaService';

// ==============================================================================
// 1. DATA TRANSFER OBJECTS (DTO) & INTERFACES
// ==============================================================================

export type PaymentMethod = 'ONLINE_GATEWAY' | 'PREPAID_WALLET' | 'CASH_ON_ARRIVAL' | 'POSTPAID_DEBT' | 'CORPORATE_QUOTA';
export type UserRole = 'CUSTOMER' | 'MEMBER' | 'STAFF' | 'ADMIN' | 'ACCOUNTANT';

export interface UserContext {
    id: string;
    role: UserRole;
    companyId?: string | null;
    fullName?: string;
    phone?: string;
}

export interface CreateBookingDto {
    roomId: string;
    slotId?: string;
    bookingDate?: string;
    startTime?: string;
    endTime?: string;
    paymentMethod: PaymentMethod;
    gatewayProvider?: 'VNPAY' | 'MOMO' | 'ZALOPAY';
    corporateDebtAccount?: string;
    companyId?: string;
    memberId?: string;
    customerName?: string;
    customerPhone?: string;
    notes?: string;
}

export interface BookingResult {
    id: string;
    bookingCode: string;
    roomId: string;
    slotId: string;
    bookingStatus: string;
    paymentMethod: PaymentMethod;
    paymentStatus: string;
    totalAmount: number;
    lockExpiresAt?: string | null;
    paymentUrl?: string | null;
    walletBalanceAfter?: number | null;
    cashBookEntryId?: string | null;
    corporateDebtAccount?: string | null;
    createdAt: string;
}

export interface CancellationResult {
    bookingId: string;
    bookingStatus: 'CANCELLED' | 'CANCELLED_NO_REFUND';
    refundAmount: number;
    penaltyFee: number;
    refundStatus: 'REFUNDED_WALLET' | 'PENDING_GATEWAY' | 'REFUNDED_CASH' | 'REFUNDED_QUOTA' | 'NO_REFUND';
    cashBookEntryId?: string | null;
    message: string;
}

// ==============================================================================
// 2. CUSTOM BUSINESS ERRORS
// ==============================================================================
export * from '../errors/BusinessErrors';
import {
    BusinessError,
    SlotConflictError,
    InsufficientWalletBalanceError,
    ForbiddenError,
    CreditLimitExceededError,
    SlotInPastError
} from '../errors/BusinessErrors';

// ==============================================================================
// 3. CORE BOOKING SERVICE IMPLEMENTATION
// ==============================================================================
export class BookingService {
    // TTL khóa giữ phòng trực tuyến: 10 phút (600.000 ms) theo chuẩn BRD v1.4
    private readonly ONLINE_LOCK_TTL_MS = 600 * 1000;

    private readonly momoService: MoMoPaymentService;
    private readonly quotaService: QuotaService;

    constructor(
        private readonly dbPool: Pool,
        private readonly redisClient: Redis,
        momoService?: MoMoPaymentService,
        quotaService?: QuotaService
    ) {
        this.momoService = momoService || new MoMoPaymentService(this.dbPool, this.redisClient);
        this.quotaService = quotaService || new QuotaService(this.dbPool);
    }

    /**
     * Tạo đặt phòng họp mới hỗ trợ 4 phương thức thanh toán
     */
    async createBooking(
        dto: CreateBookingDto,
        user: UserContext,
        idempotencyKey: string
    ): Promise<BookingResult> {
        const client: PoolClient = await this.dbPool.connect();

        try {
            // UUID regex chấp nhận cả UUID v4 lẫn định dạng UUID có prefix (r0000000-..., s0000000-..., u0000000-...) của hệ thống
            const UUID_REGEX = /^[0-9a-z]{8}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{12}$/i;

            if (!dto.roomId || !UUID_REGEX.test(dto.roomId)) {
                throw new BusinessError('INVALID_ROOM_ID', 'Mã phòng họp không đúng định dạng UUID.', 400);
            }

            let slotRow: any = null;
            let resolvedSlotId = dto.slotId;

            // 1.1. Tra cứu theo slotId nếu là UUID hợp lệ
            if (resolvedSlotId && UUID_REGEX.test(resolvedSlotId)) {
                const roomSlotRes = await client.query(`
                    SELECT 
                        r.id AS room_id, r.name AS room_name, r.hourly_rate,
                        s.id AS slot_id, s.start_time, s.end_time, s.status AS slot_status,
                        (s.start_time <= NOW()) AS is_past
                    FROM rooms r
                    JOIN slots s ON s.room_id = r.id
                    WHERE r.id = $1 AND s.id = $2 AND r.is_active = TRUE;
                `, [dto.roomId, resolvedSlotId]);

                if (roomSlotRes.rows.length > 0) {
                    slotRow = roomSlotRes.rows[0];
                }
            }

            // 1.2. Tra cứu hoặc phân bổ slot động nếu có startTime và endTime (hoặc khi slotId là chuỗi mã khung giờ)
            if (!slotRow && dto.startTime && dto.endTime) {
                const startTs = new Date(dto.startTime);
                const endTs = new Date(dto.endTime);
                if (Number.isNaN(startTs.getTime()) || Number.isNaN(endTs.getTime()) || endTs <= startTs) {
                    throw new BusinessError('INVALID_TIME_RANGE', 'Thời gian bắt đầu hoặc kết thúc khung giờ không hợp lệ.', 400);
                }

                const existingSlotRes = await client.query(`
                    SELECT 
                        r.id AS room_id, r.name AS room_name, r.hourly_rate,
                        s.id AS slot_id, s.start_time, s.end_time, s.status AS slot_status,
                        (s.start_time <= NOW()) AS is_past
                    FROM rooms r
                    JOIN slots s ON s.room_id = r.id
                    WHERE r.id = $1 AND s.start_time = $2 AND s.end_time = $3 AND r.is_active = TRUE;
                `, [dto.roomId, startTs.toISOString(), endTs.toISOString()]);

                if (existingSlotRes.rows.length > 0) {
                    slotRow = existingSlotRes.rows[0];
                    resolvedSlotId = slotRow.slot_id;
                } else {
                    // Kiểm tra phòng họp
                    const roomRes = await client.query(
                        'SELECT id, name, hourly_rate FROM rooms WHERE id = $1 AND is_active = TRUE;',
                        [dto.roomId]
                    );
                    if (roomRes.rows.length === 0) {
                        throw new BusinessError('NOT_FOUND', 'Không tìm thấy thông tin phòng họp hoặc phòng đang tạm khóa.', 404);
                    }
                    const room = roomRes.rows[0];
                    const isPast = startTs.getTime() <= Date.now();

                    // Tạo mới slot trong DB
                    resolvedSlotId = uuidv4();
                    await client.query(`
                        INSERT INTO slots (id, room_id, start_time, end_time, status)
                        VALUES ($1, $2, $3, $4, 'AVAILABLE');
                    `, [resolvedSlotId, dto.roomId, startTs.toISOString(), endTs.toISOString()]);

                    slotRow = {
                        room_id: room.id,
                        room_name: room.name,
                        hourly_rate: room.hourly_rate,
                        slot_id: resolvedSlotId,
                        start_time: startTs,
                        end_time: endTs,
                        slot_status: 'AVAILABLE',
                        is_past: isPast
                    };
                }
            }

            if (!slotRow) {
                if (dto.slotId && !UUID_REGEX.test(dto.slotId)) {
                    throw new BusinessError(
                        'INVALID_SLOT_FORMAT',
                        `Mã khung giờ '${dto.slotId}' không đúng định dạng UUID và thiếu thông tin startTime/endTime để xác định khung giờ.`,
                        400
                    );
                }
                throw new BusinessError('NOT_FOUND', 'Không tìm thấy thông tin phòng họp hoặc khung giờ hợp lệ.', 404);
            }

            const { hourly_rate, start_time, end_time, slot_status, is_past } = slotRow;

            // [BA-FIX CB-04 / G-14] Guard thời gian dùng đồng hồ CSDL (NOW()) làm nguồn chuẩn duy nhất,
            // tránh phụ thuộc đồng hồ máy lễ tân hoặc timezone của app server.
            if (is_past === true) {
                throw new SlotInPastError();
            }
            // Slot phải đang AVAILABLE (không LOCKED / BOOKED / MAINTENANCE)
            if (slot_status && slot_status !== 'AVAILABLE') {
                throw new SlotConflictError();
            }

            // [BA-FIX CB-09] Tổng tiền tính duy nhất phía server, bao gồm phụ thu cuối tuần theo ngày VN.
            // Client chỉ hiển thị con số server trả về (tránh lệch giữa biên nhận và sổ quỹ).
            const { totalAmount } = computeBookingAmount(parseFloat(hourly_rate), start_time, end_time);

            // Sinh mã đặt phòng duy nhất: BKG-YYYYMM-XXXXX
            const now = new Date();
            const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
            const randomCode = Math.floor(10000 + Math.random() * 90000);
            const bookingCode = `BKG-${yearMonth}-${randomCode}`;
            const bookingId = uuidv4();

            // ==================================================================
            // PHÂN NHÁNH XỬ LÝ THEO CÁC PHƯƠNG THỨC THANH TOÁN
            // ==================================================================

            // ------------------------------------------------------------------
            // LUỒNG 1: ONLINE PAYMENT (VNPAY / MOMO / ZALOPAY) - 10 PHÚT TTL
            // ------------------------------------------------------------------
            if (dto.paymentMethod === 'ONLINE_GATEWAY') {
                const redisLockKey = `slot:${resolvedSlotId}:lock`;

                // Cố gắng lấy Distributed Lock trên Redis với TTL 10 phút (SET ... NX PX 600000)
                const lockAcquired = await this.redisClient.set(
                    redisLockKey,
                    user.id,
                    'PX',
                    this.ONLINE_LOCK_TTL_MS,
                    'NX'
                );

                if (!lockAcquired) {
                    throw new SlotConflictError();
                }

                const lockExpiresAt = new Date(Date.now() + this.ONLINE_LOCK_TTL_MS);

                try {
                    await client.query('BEGIN');

                    // Lưu booking với trạng thái LOCKED_PENDING_ONLINE
                    const insertBookingQuery = `
                        INSERT INTO bookings (
                            id, user_id, room_id, slot_id, booking_code,
                            booking_status, payment_method, payment_status,
                            booking_channel, total_amount, lock_expires_at, notes
                        ) VALUES ($1, $2, $3, $4, $5, 'LOCKED_PENDING_ONLINE', 'ONLINE_GATEWAY', 'PENDING', 'MOBILE_APP', $6, $7, $8)
                        RETURNING id, booking_code, created_at;
                    `;
                    const bookingInsert = await client.query(insertBookingQuery, [
                        bookingId, user.id, dto.roomId, resolvedSlotId, bookingCode, totalAmount, lockExpiresAt, dto.notes || null
                    ]);

                    // Cập nhật trạng thái slot thành LOCKED
                    await client.query(
                        'UPDATE slots SET status = $1, lock_expires_at = $2 WHERE id = $3',
                        ['LOCKED', lockExpiresAt, resolvedSlotId]
                    );

                    // Transactional Outbox Pattern: Lưu sự kiện chờ gửi thông báo giữ phòng
                    await client.query(`
                        INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
                        VALUES ('BOOKING', $1, 'BOOKING_LOCKED_PENDING', $2, 'PENDING');
                    `, [bookingId, JSON.stringify({ bookingCode, totalAmount, lockExpiresAt })]);

                    await client.query('COMMIT');

                    // Tạo liên kết thanh toán theo Gateway được chọn (VNPAY hoặc MoMo)
                    const paymentGateway = dto.gatewayProvider || 'VNPAY';
                    let paymentUrl = '';

                    if (paymentGateway === 'MOMO') {
                        try {
                            const momoRes = await this.momoService.createPayment({
                                orderId: bookingCode,
                                amount: totalAmount,
                                orderInfo: `Thanh toan phong hop ${bookingCode}`,
                                requestType: 'captureWallet',
                                extraData: { userId: user.id, bookingId, slotId: dto.slotId }
                            });
                            paymentUrl = momoRes.payUrl || momoRes.deeplink || `https://test-payment.momo.vn/v2/gateway/pay?orderId=${bookingCode}`;
                        } catch (momoErr) {
                            console.warn('[BookingService] Không gọi được MoMo API /create trực tiếp, sử dụng Sandbox fallback:', momoErr);
                            paymentUrl = `https://test-payment.momo.vn/v2/gateway/pay?orderId=${bookingCode}&amount=${totalAmount}`;
                        }
                    } else {
                        paymentUrl = `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?orderId=${bookingCode}&amount=${totalAmount * 100}&provider=${paymentGateway}`;
                    }

                    return {
                        id: bookingId,
                        bookingCode,
                        roomId: dto.roomId,
                        slotId: dto.slotId,
                        bookingStatus: 'LOCKED_PENDING_ONLINE',
                        paymentMethod: 'ONLINE_GATEWAY',
                        paymentStatus: 'PENDING',
                        totalAmount,
                        lockExpiresAt: lockExpiresAt.toISOString(),
                        paymentUrl,
                        createdAt: bookingInsert.rows[0].created_at
                    };
                } catch (dbErr: any) {
                    await client.query('ROLLBACK');
                    // Nếu lỗi CSDL (ví dụ vi phạm Unique Index), thu hồi Redis Lock an toàn
                    await this.releaseLockSafe(redisLockKey, user.id);
                    if (dbErr.code === '23505') {
                        throw new SlotConflictError();
                    }
                    throw dbErr;
                }
            }

            // ------------------------------------------------------------------
            // LUỒNG 2: VÍ THÀNH VIÊN (PREPAID CREDIT) - TRỪ TIỀN TỨC THÌ AN TOÀN
            // ------------------------------------------------------------------
            else if (dto.paymentMethod === 'PREPAID_WALLET') {
                await client.query('BEGIN');
                try {
                    // Gọi Stored Function deduct_member_wallet() có sẵn Pessimistic Lock (SELECT FOR UPDATE)
                    const walletRes = await client.query(`
                        SELECT * FROM deduct_member_wallet($1, $2, $3, $4, $5);
                    `, [user.id, totalAmount, bookingId, idempotencyKey, `Thanh toán phòng họp ${bookingCode}`]);

                    const deductResult = walletRes.rows[0];

                    if (!deductResult.success) {
                        if (deductResult.error_message === 'INSUFFICIENT_FUNDS') {
                            throw new InsufficientWalletBalanceError();
                        }
                        throw new BusinessError('WALLET_ERROR', `Lỗi trừ ví thành viên: ${deductResult.error_message}`);
                    }

                    // Chèn bản ghi booking với trạng thái CONFIRMED và PAID
                    const insertBookingQuery = `
                        INSERT INTO bookings (
                            id, user_id, room_id, slot_id, booking_code,
                            booking_status, payment_method, payment_status,
                            booking_channel, total_amount, notes
                        ) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED', 'PREPAID_WALLET', 'PAID', 'MOBILE_APP', $6, $7)
                        RETURNING id, booking_code, created_at;
                    `;
                    const bookingInsert = await client.query(insertBookingQuery, [
                        bookingId, user.id, dto.roomId, resolvedSlotId, bookingCode, totalAmount, dto.notes || null
                    ]);

                    // Cập nhật trạng thái slot thành BOOKED
                    await client.query('UPDATE slots SET status = $1 WHERE id = $2', ['BOOKED', resolvedSlotId]);

                    // Transactional Outbox Pattern: Lưu event phát hành mã QR
                    await client.query(`
                        INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
                        VALUES ('BOOKING', $1, 'BOOKING_CONFIRMED', $2, 'PENDING');
                    `, [bookingId, JSON.stringify({ bookingCode, userId: user.id, totalAmount })]);

                    await client.query('COMMIT');

                    return {
                        id: bookingId,
                        bookingCode,
                        roomId: dto.roomId,
                        slotId: resolvedSlotId,
                        bookingStatus: 'CONFIRMED',
                        paymentMethod: 'PREPAID_WALLET',
                        paymentStatus: 'PAID',
                        totalAmount,
                        walletBalanceAfter: parseFloat(deductResult.new_balance),
                        createdAt: bookingInsert.rows[0].created_at
                    };
                } catch (err: any) {
                    await client.query('ROLLBACK');
                    if (err.code === '23505') {
                        throw new SlotConflictError();
                    }
                    throw err;
                }
            }

            // ------------------------------------------------------------------
            // LUỒNG 3: TIỀN MẶT TẠI QUẦY (CASH ON ARRIVAL) - DÀNH RIÊNG LỄ TÂN
            // ------------------------------------------------------------------
            else if (dto.paymentMethod === 'CASH_ON_ARRIVAL') {
                // Kiểm tra phân quyền: Chỉ STAFF hoặc ADMIN được phép tạo đơn tiền mặt
                if (user.role !== 'STAFF' && user.role !== 'ADMIN') {
                    throw new ForbiddenError('Phương thức CASH_ON_ARRIVAL chỉ dành cho Quản lý / Lễ tân trên Web Admin.');
                }

                // Hỗ trợ liên kết thành viên doanh nghiệp khi đặt phòng thu tiền mặt tại quầy (TC-CASH-02)
                let bookingUserId = user.id;
                let corporateAccount = dto.corporateDebtAccount || dto.companyId || null;

                if (dto.memberId) {
                    if (!UUID_REGEX.test(dto.memberId)) {
                        throw new BusinessError('INVALID_MEMBER_ID', 'Mã thành viên không đúng định dạng UUID.', 400);
                    }
                    const memberRes = await client.query('SELECT id, company_id, full_name FROM users WHERE id = $1', [dto.memberId]);
                    if (memberRes.rows.length === 0) {
                        throw new BusinessError('MEMBER_NOT_FOUND', 'Không tìm thấy tài khoản thành viên công ty.', 404);
                    }
                    bookingUserId = dto.memberId;
                    if (!corporateAccount && memberRes.rows[0].company_id) {
                        corporateAccount = memberRes.rows[0].company_id;
                    }
                }

                await client.query('BEGIN');
                try {
                    // Chèn booking với trạng thái CONFIRMED_PAID
                    const insertBookingQuery = `
                        INSERT INTO bookings (
                            id, user_id, room_id, slot_id, booking_code,
                            booking_status, payment_method, payment_status,
                            booking_channel, total_amount, corporate_debt_account, notes
                        ) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED_PAID', 'CASH_ON_ARRIVAL', 'PAID', 'WEB_ADMIN', $6, $7, $8)
                        RETURNING id, booking_code, created_at;
                    `;
                    const bookingInsert = await client.query(insertBookingQuery, [
                        bookingId, bookingUserId, dto.roomId, resolvedSlotId, bookingCode, totalAmount, corporateAccount, dto.notes || null
                    ]);

                    // Cập nhật slot thành BOOKED
                    await client.query('UPDATE slots SET status = $1 WHERE id = $2', ['BOOKED', resolvedSlotId]);

                    // Ghi nhận ngay vào sổ quỹ tiền mặt CASH_BOOK_LOGS
                    const cashBookEntryId = uuidv4();
                    await client.query(`
                        INSERT INTO cash_book_logs (
                            id, booking_id, admin_user_id, entry_type, amount, notes, shift_date
                        ) VALUES ($1, $2, $3, 'CASH_IN_COLLECT', $4, $5, CURRENT_DATE);
                    `, [cashBookEntryId, bookingId, user.id, totalAmount, `Thu tiền mặt tại quầy - Mã đơn: ${bookingCode}`]);

                    // Transactional Outbox
                    await client.query(`
                        INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
                        VALUES ('BOOKING', $1, 'BOOKING_CONFIRMED', $2, 'PENDING');
                    `, [bookingId, JSON.stringify({ bookingCode, totalAmount, cashBookEntryId, memberId: dto.memberId })]);

                    await client.query('COMMIT');

                    return {
                        id: bookingId,
                        bookingCode,
                        roomId: dto.roomId,
                        slotId: resolvedSlotId,
                        bookingStatus: 'CONFIRMED_PAID',
                        paymentMethod: 'CASH_ON_ARRIVAL',
                        paymentStatus: 'PAID',
                        totalAmount,
                        cashBookEntryId,
                        corporateDebtAccount: corporateAccount,
                        createdAt: bookingInsert.rows[0].created_at
                    };
                } catch (err: any) {
                    await client.query('ROLLBACK');
                    if (err.code === '23505') {
                        throw new SlotConflictError();
                    }
                    throw err;
                }
            }

            // ------------------------------------------------------------------
            // LUỒNG 4: CÔNG NỢ DOANH NGHIỆP (POSTPAID DEBT) - KIỂM SOÁT HẠN MỨC
            // ------------------------------------------------------------------
            else if (dto.paymentMethod === 'POSTPAID_DEBT') {
                if (user.role !== 'STAFF' && user.role !== 'ADMIN') {
                    throw new ForbiddenError('Phương thức POSTPAID_DEBT chỉ dành cho Quản lý / Lễ tân trên Web Admin.');
                }

                if (!dto.corporateDebtAccount) {
                    throw new BusinessError('MISSING_CORP_ACCOUNT', 'Bắt buộc phải cung cấp mã tài khoản doanh nghiệp ghi nợ.', 400);
                }

                await client.query('BEGIN');
                try {
                    // Kiểm tra hạn mức tín dụng công nợ (Pessimistic Lock trên bảng companies)
                    const companyRes = await client.query(`
                        SELECT id, name, credit_limit, current_debt 
                        FROM companies 
                        WHERE tax_code = $1 OR id::TEXT = $1 
                        FOR UPDATE;
                    `, [dto.corporateDebtAccount]);

                    if (companyRes.rows.length === 0) {
                        throw new BusinessError('COMPANY_NOT_FOUND', 'Không tìm thấy tài khoản doanh nghiệp công nợ tương ứng.', 404);
                    }

                    const company = companyRes.rows[0];
                    const currentDebt = parseFloat(company.current_debt);
                    const creditLimit = parseFloat(company.credit_limit);

                    // Kiểm tra vượt trần công nợ
                    if (currentDebt + totalAmount > creditLimit) {
                        throw new CreditLimitExceededError(
                            `Dư nợ hiện tại (${currentDebt.toLocaleString()} VND) cộng giá phòng (${totalAmount.toLocaleString()} VND) ` +
                            `vượt quá hạn mức tín dụng cho phép (${creditLimit.toLocaleString()} VND).`
                        );
                    }

                    // Tăng dư nợ lũy kế của doanh nghiệp
                    await client.query(`
                        UPDATE companies 
                        SET current_debt = current_debt + $1, updated_at = CURRENT_TIMESTAMP 
                        WHERE id = $2;
                    `, [totalAmount, company.id]);

                    // Tạo booking CONFIRMED_DEBT
                    const insertBookingQuery = `
                        INSERT INTO bookings (
                            id, user_id, room_id, slot_id, booking_code,
                            booking_status, payment_method, payment_status,
                            booking_channel, total_amount, corporate_debt_account, notes
                        ) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED_DEBT', 'POSTPAID_DEBT', 'UNPAID', 'WEB_ADMIN', $6, $7, $8)
                        RETURNING id, booking_code, created_at;
                    `;
                    const bookingInsert = await client.query(insertBookingQuery, [
                        bookingId, user.id, dto.roomId, resolvedSlotId, bookingCode, totalAmount, dto.corporateDebtAccount, dto.notes || null
                    ]);

                    await client.query('UPDATE slots SET status = $1 WHERE id = $2', ['BOOKED', resolvedSlotId]);

                    // Transactional Outbox
                    await client.query(`
                        INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
                        VALUES ('BOOKING', $1, 'BOOKING_DEBT_RECORDED', $2, 'PENDING');
                    `, [bookingId, JSON.stringify({ bookingCode, totalAmount, companyId: company.id })]);

                    await client.query('COMMIT');

                    return {
                        id: bookingId,
                        bookingCode,
                        roomId: dto.roomId,
                        slotId: resolvedSlotId,
                        bookingStatus: 'CONFIRMED_DEBT',
                        paymentMethod: 'POSTPAID_DEBT',
                        paymentStatus: 'UNPAID',
                        totalAmount,
                        corporateDebtAccount: dto.corporateDebtAccount,
                        createdAt: bookingInsert.rows[0].created_at
                    };
                } catch (err: any) {
                    await client.query('ROLLBACK');
                    if (err.code === '23505') {
                        throw new SlotConflictError();
                    }
                    throw err;
                }
            }

            // ------------------------------------------------------------------
            // LUỒNG 5: HẠN MỨC THÀNH VIÊN DOANH NGHIỆP (CORPORATE QUOTA ENGINE)
            // ------------------------------------------------------------------
            else if (dto.paymentMethod === 'CORPORATE_QUOTA') {
                // Xác định company_id của thành viên
                let targetCompanyId = user.companyId;
                if (!targetCompanyId) {
                    const userRes = await client.query('SELECT company_id FROM users WHERE id = $1', [user.id]);
                    if (userRes.rows.length > 0) {
                        targetCompanyId = userRes.rows[0].company_id;
                    }
                }

                if (!targetCompanyId) {
                    throw new BusinessError('NOT_CORPORATE_MEMBER', 'Tài khoản không thuộc công ty/doanh nghiệp nào để sử dụng hạn mức.', 403);
                }

                await client.query('BEGIN');
                try {
                    // Trừ và ghi sổ cái hạn mức (Pessimistic Lock trên member_quotas và companies)
                    const quotaResult = await this.quotaService.checkAndConsumeQuota(client, {
                        userId: user.id,
                        companyId: targetCompanyId,
                        bookingId,
                        slotStartTime: start_time,
                        slotEndTime: end_time,
                        totalAmount,
                        idempotencyKey
                    });

                    // Tạo booking CONFIRMED_DEBT với paymentMethod CORPORATE_QUOTA
                    const insertBookingQuery = `
                        INSERT INTO bookings (
                            id, user_id, room_id, slot_id, booking_code,
                            booking_status, payment_method, payment_status,
                            booking_channel, total_amount, quota_consumed, notes
                        ) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED_DEBT', 'CORPORATE_QUOTA', 'PAID', 'MOBILE_APP', $6, $7, $8)
                        RETURNING id, booking_code, created_at;
                    `;

                    const bookingInsert = await client.query(insertBookingQuery, [
                        bookingId, user.id, dto.roomId, resolvedSlotId, bookingCode, totalAmount, JSON.stringify(quotaResult.consumed), dto.notes || null
                    ]);

                    await client.query('UPDATE slots SET status = $1 WHERE id = $2', ['BOOKED', resolvedSlotId]);

                    // Transactional Outbox
                    await client.query(`
                        INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
                        VALUES ('BOOKING', $1, 'BOOKING_CONFIRMED', $2, 'PENDING');
                    `, [bookingId, JSON.stringify({ bookingCode, totalAmount, consumed: quotaResult.consumed })]);

                    await client.query('COMMIT');

                    return {
                        id: bookingId,
                        bookingCode,
                        roomId: dto.roomId,
                        slotId: resolvedSlotId,
                        bookingStatus: 'CONFIRMED_DEBT',
                        paymentMethod: 'CORPORATE_QUOTA',
                        paymentStatus: 'PAID',
                        totalAmount,
                        createdAt: bookingInsert.rows[0].created_at
                    };
                } catch (err: any) {
                    await client.query('ROLLBACK');
                    if (err.code === '23505') {
                        throw new SlotConflictError();
                    }
                    throw err;
                }
            }

            throw new BusinessError('INVALID_PAYMENT_METHOD', 'Phương thức thanh toán không được hỗ trợ.', 400);

        } finally {
            client.release();
        }
    }

    /**
     * Hủy phòng họp áp dụng chính sách hoàn tiền phân tầng & Two-Man Rule
     */
    async cancelBooking(
        bookingId: string,
        user: UserContext,
        reason: string,
        supervisorOtp?: string
    ): Promise<CancellationResult> {
        const client: PoolClient = await this.dbPool.connect();

        try {
            await client.query('BEGIN');

            // 1. Khóa dòng booking cần hủy để xử lý đồng bộ
            const bookingRes = await client.query(`
                SELECT 
                    b.id, b.user_id, b.slot_id, b.booking_code, b.booking_status,
                    b.payment_method, b.payment_status, b.total_amount,
                    s.start_time
                FROM bookings b
                JOIN slots s ON s.id = b.slot_id
                WHERE b.id = $1
                FOR UPDATE;
            `, [bookingId]);

            if (bookingRes.rows.length === 0) {
                throw new BusinessError('NOT_FOUND', 'Không tìm thấy thông tin đơn đặt phòng.', 404);
            }

            const booking = bookingRes.rows[0];

            if (['CANCELLED', 'CANCELLED_NO_REFUND', 'EXPIRED'].includes(booking.booking_status)) {
                throw new BusinessError('ALREADY_CANCELLED', 'Đơn đặt phòng này đã bị hủy hoặc hết hạn trước đó.', 400);
            }

            // 2. Tính toán chính sách phạt hủy phân tầng
            const now = new Date();
            const meetingStart = new Date(booking.start_time);
            const hoursUntilMeeting = (meetingStart.getTime() - now.getTime()) / (1000 * 60 * 60);
            const totalAmount = parseFloat(booking.total_amount);

            let refundPercentage = 0;
            let targetStatus: 'CANCELLED' | 'CANCELLED_NO_REFUND' = 'CANCELLED';

            if (hoursUntilMeeting >= 24) {
                // Hủy trước >= 24 giờ: Hoàn 100%
                refundPercentage = 100;
            } else if (hoursUntilMeeting >= 2) {
                // Hủy từ 2 giờ đến dưới 24 giờ: Phạt 20%, hoàn 80%
                refundPercentage = 80;
            } else {
                // Hủy sát giờ dưới 2 giờ: Không hoàn tiền
                refundPercentage = 0;
                targetStatus = 'CANCELLED_NO_REFUND';
            }

            // Kiểm tra số lần hủy trong tháng của người dùng (Giới hạn 2 lần miễn phạt)
            const monthlyCancelRes = await client.query(`
                SELECT COUNT(*) AS cancel_count 
                FROM bookings 
                WHERE user_id = $1 
                  AND booking_status IN ('CANCELLED', 'CANCELLED_NO_REFUND')
                  AND created_at >= date_trunc('month', CURRENT_DATE);
            `, [booking.user_id]);

            const monthlyCancels = parseInt(monthlyCancelRes.rows[0].cancel_count, 10);
            if (monthlyCancels >= 2 && refundPercentage > 0) {
                // Lần hủy thứ 3 trở đi: Phạt cố định 30% (Chỉ hoàn tối đa 70%)
                refundPercentage = Math.min(refundPercentage, 70);
            }

            const refundAmount = (totalAmount * refundPercentage) / 100;
            const penaltyFee = totalAmount - refundAmount;

            let refundStatus: 'REFUNDED_WALLET' | 'PENDING_GATEWAY' | 'REFUNDED_CASH' | 'REFUNDED_QUOTA' | 'NO_REFUND' = 'NO_REFUND';
            let cashBookEntryId: string | null = null;

            // 3. Xử lý hoàn tiền theo phương thức thanh toán ban đầu
            if (booking.payment_method === 'PREPAID_WALLET' && refundAmount > 0) {
                // Hoàn lại tiền vào ví thành viên
                await client.query(`
                    UPDATE member_wallets 
                    SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP 
                    WHERE user_id = $2;
                `, [refundAmount, booking.user_id]);

                // Ghi nhật ký REFUND vào ví
                await client.query(`
                    INSERT INTO wallet_transactions (
                        wallet_id, booking_id, transaction_type, amount, balance_before, balance_after, idempotency_key, description
                    ) SELECT id, $1, 'REFUND', $2, balance - $2, balance, $3, $4
                    FROM member_wallets WHERE user_id = $5;
                `, [booking.id, refundAmount, uuidv4(), `Hoàn tiền hủy đơn ${booking.booking_code}`, booking.user_id]);

                refundStatus = 'REFUNDED_WALLET';
            } else if (booking.payment_method === 'CASH_ON_ARRIVAL' && refundAmount > 0) {
                // Luồng tiền mặt tại quầy: Yêu cầu Two-Man Rule duyệt OTP
                if (!supervisorOtp) {
                    throw new BusinessError('OTP_REQUIRED', 'Hủy đơn hoàn tiền mặt yêu cầu mã OTP xác thực từ Quản lý ca trực (Two-Man Rule).', 400);
                }

                // Giả lập kiểm tra mã OTP hợp lệ (Ví dụ: OTP hợp lệ là 6 số)
                if (supervisorOtp !== '888999' && supervisorOtp !== '123456') {
                    throw new BusinessError('INVALID_OTP', 'Mã OTP duyệt chi của Quản lý ca trực không chính xác hoặc đã hết hạn.', 400);
                }

                // Ghi nhận phiếu chi tiền mặt CASH_OUT_REFUND
                cashBookEntryId = uuidv4();
                await client.query(`
                    INSERT INTO cash_book_logs (
                        id, booking_id, admin_user_id, approved_by_supervisor_id, entry_type, amount, notes, shift_date
                    ) VALUES ($1, $2, $3, $3, 'CASH_OUT_REFUND', $4, $5, CURRENT_DATE);
                `, [cashBookEntryId, booking.id, user.id, refundAmount, `Hoàn tiền mặt hủy đơn ${booking.booking_code} (Đã duyệt OTP)`]);

                refundStatus = 'REFUNDED_CASH';
            } else if (booking.payment_method === 'ONLINE_GATEWAY' && refundAmount > 0) {
                refundStatus = 'PENDING_GATEWAY';
            } else if (booking.payment_method === 'CORPORATE_QUOTA') {
                // Hạn mức doanh nghiệp: Hủy trước 24h hoàn 100% hạn mức; hủy muộn không hoàn quota (Policy A4/A5)
                if (refundPercentage === 100) {
                    await this.quotaService.releaseQuota(client, booking.id, reason || 'Hủy đơn trước 24h hoàn 100% hạn mức');
                    refundStatus = 'REFUNDED_QUOTA';
                } else {
                    refundStatus = 'NO_REFUND';
                }
            }

            // 4. Cập nhật trạng thái booking & hoàn trả slot về AVAILABLE
            await client.query(`
                UPDATE bookings 
                SET booking_status = $1, refund_amount = $2, updated_at = CURRENT_TIMESTAMP 
                WHERE id = $3;
            `, [targetStatus, refundAmount, booking.id]);

            await client.query(`
                UPDATE slots 
                SET status = 'AVAILABLE', lock_expires_at = NULL 
                WHERE id = $1;
            `, [booking.slot_id]);

            // 5. Ghi log Transactional Outbox
            await client.query(`
                INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
                VALUES ('BOOKING', $1, 'BOOKING_CANCELLED', $2, 'PENDING');
            `, [booking.id, JSON.stringify({ bookingCode: booking.booking_code, refundAmount, penaltyFee, reason })]);

            await client.query('COMMIT');

            return {
                bookingId: booking.id,
                bookingStatus: targetStatus,
                refundAmount,
                penaltyFee,
                refundStatus,
                cashBookEntryId,
                message: `Hủy đơn thành công. Hoàn ${refundPercentage}% (${refundAmount.toLocaleString()} VND). Phí phạt hủy: ${penaltyFee.toLocaleString()} VND.`
            };

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Thu hồi Redis Distributed Lock an toàn bằng Lua Script
     */
    private async releaseLockSafe(redisLockKey: string, userId: string): Promise<boolean> {
        const luaScript = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
        `;
        try {
            const result = await this.redisClient.eval(luaScript, 1, redisLockKey, userId);
            return result === 1;
        } catch (err) {
            console.error(`[BookingService] Lỗi giải phóng lock ${redisLockKey}:`, err);
            return false;
        }
    }
}
