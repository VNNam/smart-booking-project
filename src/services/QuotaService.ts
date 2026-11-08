/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Corporate Quota Engine & Member Budget Management
 * FILE: src/services/QuotaService.ts
 * MÔ TẢ: Xử lý toàn bộ logic kiểm tra, trừ và hoàn trả hạn mức cho thành viên
 *       thuộc doanh nghiệp (CREDIT, BOOKINGS, HOURS).
 *       Áp dụng Pessimistic Locking (FOR UPDATE) và Transactional Quota Ledger.
 * ==============================================================================
 */

import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { BusinessError } from '../errors/BusinessErrors';
import { getVnDateParts, toVnDayRange } from '../utils/businessTime';

export type QuotaType = 'CREDIT' | 'BOOKINGS' | 'HOURS';
export type ResetCycle = 'WEEKLY' | 'MONTHLY' | 'MANUAL';
export type QuotaTxType = 'CONSUME' | 'RELEASE' | 'ADJUST' | 'RESET' | 'OVERTIME';

export class MemberQuotaExceededError extends BusinessError {
    constructor(
        message = 'Hạn mức sử dụng của thành viên không đủ để thực hiện lượt đặt phòng này.',
        public readonly quotaType?: QuotaType,
        public readonly remaining?: number,
        public readonly required?: number
    ) {
        super('MEMBER_QUOTA_EXCEEDED', message, 422);
    }
}

export interface MemberQuotaItem {
    id: string;
    userId: string;
    companyId: string;
    quotaType: QuotaType;
    quotaLimit: number;
    quotaUsed: number;
    resetCycle: ResetCycle;
    periodStart: string;
    periodEnd: string;
    isActive: boolean;
}

export interface ConsumeQuotaParams {
    userId: string;
    companyId: string;
    bookingId: string;
    slotStartTime: Date | string;
    slotEndTime: Date | string;
    totalAmount: number;
    idempotencyKey: string;
}

export interface ConsumeQuotaResult {
    success: boolean;
    consumed: { [key in QuotaType]?: number };
    ledgerIds: string[];
}

export interface MemberUsageHistoryItem {
    bookingId: string;
    bookingCode: string;
    roomName: string;
    startTime: string;
    endTime: string;
    bookingStatus: string;
    paymentMethod: string;
    actualCheckIn: string | null;
    actualCheckOut: string | null;
    totalAmount: number;
    quotaConsumed: { [key in QuotaType]?: number } | null;
    createdAt: string;
}

export class QuotaService {
    constructor(private readonly dbPool: Pool) {}

    /**
     * 1. KIỂM TRA VÀ TIÊU HAO HẠN MỨC (CONSUME QUOTA)
     * Chạy bên trong transaction ngoại vi (client) cùng với việc tạo booking.
     */
    async checkAndConsumeQuota(
        client: PoolClient,
        params: ConsumeQuotaParams
    ): Promise<ConsumeQuotaResult> {
        const { userId, companyId, bookingId, slotStartTime, slotEndTime, totalAmount, idempotencyKey } = params;

        // Tính toán các đơn vị tiêu hao
        const start = new Date(slotStartTime).getTime();
        const end = new Date(slotEndTime).getTime();
        const durationHours = Math.max(1, (end - start) / (1000 * 60 * 60));

        const requiredAmounts: { [key in QuotaType]: number } = {
            CREDIT: totalAmount,
            BOOKINGS: 1,
            HOURS: durationHours
        };

        // 1. Kiểm tra trạng thái doanh nghiệp & hạn mức nợ tổng (Company Credit Limit)
        const companyRes = await client.query(
            `SELECT id, name, credit_limit, current_debt, is_active 
             FROM companies 
             WHERE id = $1 FOR UPDATE;`,
            [companyId]
        );

        if (companyRes.rows.length === 0) {
            throw new BusinessError('COMPANY_NOT_FOUND', 'Không tìm thấy thông tin doanh nghiệp.', 404);
        }

        const company = companyRes.rows[0];
        if (!company.is_active) {
            throw new BusinessError('COMPANY_INACTIVE', 'Tài khoản doanh nghiệp đang bị tạm ngưng.', 403);
        }

        // 2. Khóa tất cả các hạn mức đang hoạt động của thành viên (FOR UPDATE)
        const quotaRes = await client.query(
            `SELECT id, user_id, company_id, quota_type, quota_limit, quota_used, reset_cycle, period_start, period_end, is_active
             FROM member_quotas
             WHERE user_id = $1 AND is_active = TRUE
             ORDER BY id ASC
             FOR UPDATE;`,
            [userId]
        );

        if (quotaRes.rows.length === 0) {
            throw new BusinessError('NO_ACTIVE_QUOTA', 'Thành viên chưa được cấp hạn mức doanh nghiệp.', 422);
        }

        // 3. Kiểm tra trần cho TẤT CẢ các hạn mức mà thành viên đang có
        const quotasToUpdate: { row: any; cost: number; newUsed: number }[] = [];
        let hasCreditQuota = false;

        for (const row of quotaRes.rows) {
            const qType = row.quota_type as QuotaType;
            const cost = requiredAmounts[qType];
            const currentUsed = parseFloat(row.quota_used);
            const limit = parseFloat(row.quota_limit);
            const newUsed = currentUsed + cost;

            if (newUsed > limit) {
                const remaining = Math.max(0, limit - currentUsed);
                throw new MemberQuotaExceededError(
                    `Hạn mức [${qType}] của thành viên không đủ. Còn lại: ${remaining}, cần: ${cost}.`,
                    qType,
                    remaining,
                    cost
                );
            }

            if (qType === 'CREDIT') {
                hasCreditQuota = true;
            }

            quotasToUpdate.push({ row, cost, newUsed });
        }

        // 4. Nếu có hạn mức CREDIT, kiểm tra trần nợ toàn công ty
        if (hasCreditQuota) {
            const companyLimit = parseFloat(company.credit_limit);
            const companyCurrentDebt = parseFloat(company.current_debt);
            if (companyCurrentDebt + totalAmount > companyLimit) {
                throw new BusinessError(
                    'CREDIT_LIMIT_EXCEEDED',
                    `Tổng công nợ công ty vượt hạn mức tín dụng (${companyLimit.toLocaleString()} VND).`,
                    422
                );
            }

            // Tăng công nợ tích lũy của công ty
            await client.query(
                `UPDATE companies 
                 SET current_debt = current_debt + $1, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = $2;`,
                [totalAmount, companyId]
            );
        }

        // 5. Cập nhật từng hạn mức và ghi nhật ký vào sổ cái quota_ledger
        const consumedSummary: { [key in QuotaType]?: number } = {};
        const ledgerIds: string[] = [];

        for (const { row, cost, newUsed } of quotasToUpdate) {
            const qType = row.quota_type as QuotaType;
            await client.query(
                `UPDATE member_quotas 
                 SET quota_used = $1, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = $2;`,
                [newUsed, row.id]
            );

            const ledgerId = uuidv4();
            const txIdempotency = `${idempotencyKey}:${qType}`;

            await client.query(
                `INSERT INTO quota_ledger (
                    id, member_quota_id, user_id, company_id, booking_id,
                    tx_type, amount, used_before, used_after, period_start,
                    reason, idempotency_key
                ) VALUES ($1, $2, $3, $4, $5, 'CONSUME', $6, $7, $8, $9, $10, $11);`,
                [
                    ledgerId,
                    row.id,
                    userId,
                    companyId,
                    bookingId,
                    cost,
                    parseFloat(row.quota_used),
                    newUsed,
                    row.period_start,
                    `Tiêu hao hạn mức đặt phòng họp (${qType})`,
                    txIdempotency
                ]
            );

            consumedSummary[qType] = cost;
            ledgerIds.push(ledgerId);
        }

        return {
            success: true,
            consumed: consumedSummary,
            ledgerIds
        };
    }

    /**
     * 2. HOÀN TRẢ HẠN MỨC KHI HỦY PHÒNG HỢP LỆ (RELEASE QUOTA)
     */
    async releaseQuota(
        client: PoolClient,
        bookingId: string,
        reason: string
    ): Promise<{ released: boolean; entriesRestored: number }> {
        // Tìm các bản ghi tiêu hao ban đầu của booking này
        const consumeEntriesRes = await client.query(
            `SELECT id, member_quota_id, user_id, company_id, amount, tx_type
             FROM quota_ledger
             WHERE booking_id = $1 AND tx_type = 'CONSUME';`,
            [bookingId]
        );

        if (consumeEntriesRes.rows.length === 0) {
            return { released: false, entriesRestored: 0 };
        }

        let entriesRestored = 0;

        for (const entry of consumeEntriesRes.rows) {
            const amount = parseFloat(entry.amount);

            // Khóa và cập nhật lại hạn mức thành viên (giảm used)
            const quotaRes = await client.query(
                `SELECT id, quota_used, quota_type, period_start 
                 FROM member_quotas 
                 WHERE id = $1 FOR UPDATE;`,
                [entry.member_quota_id]
            );

            if (quotaRes.rows.length > 0) {
                const quota = quotaRes.rows[0];
                const currentUsed = parseFloat(quota.quota_used);
                const restoredUsed = Math.max(0, currentUsed - amount);

                await client.query(
                    `UPDATE member_quotas 
                     SET quota_used = $1, updated_at = CURRENT_TIMESTAMP 
                     WHERE id = $2;`,
                    [restoredUsed, quota.id]
                );

                // Ghi sổ cái RELEASE
                const releaseLedgerId = uuidv4();
                const idempotencyKey = `release:${bookingId}:${quota.quota_type}`;

                await client.query(
                    `INSERT INTO quota_ledger (
                        id, member_quota_id, user_id, company_id, booking_id,
                        tx_type, amount, used_before, used_after, period_start,
                        reason, idempotency_key
                    ) VALUES ($1, $2, $3, $4, $5, 'RELEASE', $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (idempotency_key) DO NOTHING;`,
                    [
                        releaseLedgerId,
                        quota.id,
                        entry.user_id,
                        entry.company_id,
                        bookingId,
                        amount,
                        currentUsed,
                        restoredUsed,
                        quota.period_start,
                        reason || 'Hoàn trả hạn mức khi hủy phòng',
                        idempotencyKey
                    ]
                );

                // Nếu là CREDIT, hoàn lại cả current_debt của công ty
                if (quota.quota_type === 'CREDIT') {
                    await client.query(
                        `UPDATE companies 
                         SET current_debt = GREATEST(0.00, current_debt - $1), updated_at = CURRENT_TIMESTAMP 
                         WHERE id = $2;`,
                        [amount, entry.company_id]
                    );
                }

                entriesRestored++;
            }
        }

        return { released: true, entriesRestored };
    }

    /**
     * 3. ĐIỀU CHỈNH / CẬP NHẬT HẠN MỨC THÀNH VIÊN (ADMIN / ACCOUNTANT)
     */
    async setMemberQuota(
        adminUserId: string,
        params: {
            userId: string;
            companyId: string;
            quotaType: QuotaType;
            quotaLimit: number;
            resetCycle?: ResetCycle;
        }
    ): Promise<MemberQuotaItem> {
        const { userId, companyId, quotaType, quotaLimit, resetCycle = 'MONTHLY' } = params;

        if (quotaLimit < 0) {
            throw new BusinessError('INVALID_LIMIT', 'Hạn mức không được là số âm.', 400);
        }

        const client = await this.dbPool.connect();
        try {
            await client.query('BEGIN');

            const nowVn = getVnDateParts(new Date());
            const periodStart = `${nowVn.year}-${String(nowVn.month).padStart(2, '0')}-01`;
            const periodEnd = `${nowVn.year}-${String(nowVn.month).padStart(2, '0')}-28`; // Safe monthly end

            const upsertQuery = `
                INSERT INTO member_quotas (
                    user_id, company_id, quota_type, quota_limit, quota_used, reset_cycle,
                    period_start, period_end, is_active, updated_by
                ) VALUES ($1, $2, $3, $4, 0.00, $5, $6, $7, TRUE, $8)
                ON CONFLICT (user_id, quota_type) DO UPDATE SET
                    quota_limit = EXCLUDED.quota_limit,
                    reset_cycle = EXCLUDED.reset_cycle,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id, user_id, company_id, quota_type, quota_limit, quota_used, reset_cycle, period_start, period_end, is_active;
            `;

            const res = await client.query(upsertQuery, [
                userId, companyId, quotaType, quotaLimit, resetCycle, periodStart, periodEnd, adminUserId
            ]);

            const item = res.rows[0];

            // Ghi nhận sổ cái ADJUST
            const ledgerId = uuidv4();
            await client.query(
                `INSERT INTO quota_ledger (
                    id, member_quota_id, user_id, company_id, tx_type, amount,
                    used_before, used_after, period_start, reason, performed_by, idempotency_key
                ) VALUES ($1, $2, $3, $4, 'ADJUST', $5, $6, $6, $7, $8, $9, $10);`,
                [
                    ledgerId,
                    item.id,
                    userId,
                    companyId,
                    quotaLimit,
                    parseFloat(item.quota_used),
                    item.period_start,
                    `Admin cập nhật hạn mức ${quotaType} thành ${quotaLimit}`,
                    adminUserId,
                    `adjust:${item.id}:${Date.now()}`
                ]
            );

            await client.query('COMMIT');

            return {
                id: item.id,
                userId: item.user_id,
                companyId: item.company_id,
                quotaType: item.quota_type,
                quotaLimit: parseFloat(item.quota_limit),
                quotaUsed: parseFloat(item.quota_used),
                resetCycle: item.reset_cycle,
                periodStart: item.period_start,
                periodEnd: item.period_end,
                isActive: item.is_active
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * 4. BÁO CÁO CHI TIẾT LỊCH SỬ SỬ DỤNG CỦA THÀNH VIÊN
     */
    async getMemberUsageHistory(
        memberId: string,
        fromDate?: string,
        toDate?: string
    ): Promise<MemberUsageHistoryItem[]> {
        let dateCondition = '';
        const queryParams: any[] = [memberId];

        if (fromDate && toDate) {
            const { startTs, endTs } = toVnDayRange(fromDate, toDate);
            queryParams.push(startTs.toISOString(), endTs.toISOString());
            dateCondition = 'AND b.created_at >= $2 AND b.created_at < $3';
        }

        const query = `
            SELECT 
                b.id AS booking_id,
                b.booking_code,
                r.name AS room_name,
                s.start_time,
                s.end_time,
                b.booking_status,
                b.payment_method,
                b.actual_check_in,
                b.actual_check_out,
                b.total_amount,
                b.quota_consumed,
                b.created_at
            FROM bookings b
            JOIN rooms r ON r.id = b.room_id
            JOIN slots s ON s.id = b.slot_id
            WHERE b.user_id = $1 ${dateCondition}
            ORDER BY s.start_time DESC;
        `;

        const res = await this.dbPool.query(query, queryParams);

        return res.rows.map((row: any) => ({
            bookingId: row.booking_id,
            bookingCode: row.booking_code,
            roomName: row.room_name,
            startTime: row.start_time,
            endTime: row.end_time,
            bookingStatus: row.booking_status,
            paymentMethod: row.payment_method,
            actualCheckIn: row.actual_check_in ? new Date(row.actual_check_in).toISOString() : null,
            actualCheckOut: row.actual_check_out ? new Date(row.actual_check_out).toISOString() : null,
            totalAmount: parseFloat(row.total_amount),
            quotaConsumed: row.quota_consumed || null,
            createdAt: row.created_at
        }));
    }
}

