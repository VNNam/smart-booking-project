/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Finance & Reconciliation Service
 * FILE: src/services/AccountingService.ts
 * MÔ TẢ: Xử lý logic nghiệp vụ kế toán, đối soát đa kênh và sổ quỹ tiền mặt:
 *       1. Lọc đối soát chính xác theo khoảng ngày [Từ ngày] - [Đến ngày] (inclusive)
 *       2. Hợp nhất 4 nguồn: Payments (Gateways), Bookings, Quota Ledger, Cash Book
 *       3. Tính toán tổng thu/chi tiền mặt (IN/OUT) và chốt số dư két ca trực
 * ==============================================================================
 */

import { Pool } from 'pg';
import { toVnDayRange } from '../utils/businessTime';

export interface DateRangeFilterDto {
    from: string; // YYYY-MM-DD
    to: string;   // YYYY-MM-DD
    channel?: 'ALL' | 'MOMO' | 'VNPAY' | 'WALLET' | 'CASH' | 'CORPORATE_QUOTA';
    companyId?: string;
    page?: number;
    pageSize?: number;
}

export interface UnifiedReconciliationItem {
    id: string;
    bookingCode: string;
    channel: 'MOMO' | 'VNPAY' | 'WALLET' | 'CASH' | 'CORPORATE_QUOTA';
    transId: string;
    orderAmount: number;
    receivedAmount: number;
    gatewayStatus: 'MATCHED' | 'AUTO_REFUNDED' | 'FAILED' | 'PENDING';
    reconciliationStatus: 'MATCHED' | 'DISCREPANCY' | 'PENDING';
    notes: string;
    verifiedBy?: string;
    verifiedAt?: string;
    createdAt: string;
    companyName?: string;
    memberName?: string;
}

export interface DailyCashSummaryItem {
    date: string; // YYYY-MM-DD
    cashInAmount: number;
    cashInCount: number;
    cashOutAmount: number;
    cashOutCount: number;
    netAmount: number;
}

export interface CashDrawerSummary {
    totalCashIn: number;
    totalCashOut: number;
    netCashInDrawer: number;
    transactionCount: number;
}

export interface ReconciliationReportResult {
    from: string;
    to: string;
    startTs: string;
    endTs: string;
    summary: {
        totalRevenue: number;
        totalOnlineAmount: number;
        totalWalletAmount: number;
        totalCashAmount: number;
        totalQuotaCreditAmount: number;
        totalTransactions: number;
    };
    cashDrawer: CashDrawerSummary;
    dailyCashSummary: DailyCashSummaryItem[];
    items: UnifiedReconciliationItem[];
}

export class AccountingService {
    constructor(private readonly dbPool: Pool) {}

    /**
     * BỘ LỌC ĐỐI SOÁT THEO KHOẢNG THỜI GIAN (DATE RANGE FILTER VIA CALENDAR)
     * Đảm bảo tính toán chính xác trên múi giờ Việt Nam, bao gồm cả ngày bắt đầu và kết thúc.
     */
    async getReconciliationReport(dto: DateRangeFilterDto): Promise<ReconciliationReportResult> {
        const { from, to, channel = 'ALL', companyId } = dto;
        const { startTs, endTs } = toVnDayRange(from, to);

        const startIso = startTs.toISOString();
        const endIso = endTs.toISOString();

        // 1. TRUY VẤN GIAO DỊCH CỔNG THANH TOÁN & ĐƠN ĐẶT PHÒNG
        const paymentsQuery = `
            SELECT 
                p.id AS payment_id,
                b.id AS booking_id,
                b.booking_code,
                p.gateway,
                p.transaction_code,
                b.total_amount AS order_amount,
                p.amount AS received_amount,
                p.payment_status AS p_status,
                b.payment_status AS b_status,
                b.payment_method,
                c.name AS company_name,
                u.full_name AS member_name,
                p.created_at
            FROM payments p
            JOIN bookings b ON b.id = p.booking_id
            JOIN users u ON u.id = b.user_id
            LEFT JOIN companies c ON c.id = u.company_id
            WHERE p.created_at >= $1 AND p.created_at < $2
            ORDER BY p.created_at DESC;
        `;
        const paymentsRes = await this.dbPool.query(paymentsQuery, [startIso, endIso]);

        // 2. TRUY VẤN SỔ QUỸ TIỀN MẶT (CASH_BOOK_LOGS)
        const cashQuery = `
            SELECT 
                cb.id AS cash_id,
                b.id AS booking_id,
                b.booking_code,
                cb.entry_type,
                cb.amount,
                cb.notes,
                cb.shift_date,
                cb.created_at,
                staff.full_name AS staff_name,
                sup.full_name AS supervisor_name
            FROM cash_book_logs cb
            JOIN bookings b ON b.id = cb.booking_id
            JOIN users staff ON staff.id = cb.admin_user_id
            LEFT JOIN users sup ON sup.id = cb.approved_by_supervisor_id
            WHERE cb.created_at >= $1 AND cb.created_at < $2
            ORDER BY cb.created_at DESC;
        `;
        const cashRes = await this.dbPool.query(cashQuery, [startIso, endIso]);

        // 3. TRUY VẤN TIÊU HAO HẠN MỨC DOANH NGHIỆP (QUOTA_LEDGER)
        const quotaQuery = `
            SELECT 
                ql.id AS ledger_id,
                b.booking_code,
                c.name AS company_name,
                u.full_name AS member_name,
                ql.amount,
                ql.tx_type,
                ql.reason,
                ql.created_at,
                mq.quota_type
            FROM quota_ledger ql
            LEFT JOIN bookings b ON b.id = ql.booking_id
            JOIN companies c ON c.id = ql.company_id
            JOIN users u ON u.id = ql.user_id
            JOIN member_quotas mq ON mq.id = ql.member_quota_id
            WHERE ql.created_at >= $1 AND ql.created_at < $2
              AND ($3::UUID IS NULL OR ql.company_id = $3::UUID)
            ORDER BY ql.created_at DESC;
        `;
        const quotaRes = await this.dbPool.query(quotaQuery, [startIso, endIso, companyId || null]);

        // 4. HỢP NHẤT VÀ CHUYỂN ĐỔI THÀNH DANH SÁCH ĐỐI SOÁT CHUẨN
        const items: UnifiedReconciliationItem[] = [];

        // Hợp nhất thanh toán Gateway & Ví
        for (const row of paymentsRes.rows) {
            let ch: 'MOMO' | 'VNPAY' | 'WALLET' = 'MOMO';
            if (row.gateway === 'VNPAY') ch = 'VNPAY';
            else if (row.gateway === 'WALLET' || row.payment_method === 'PREPAID_WALLET') ch = 'WALLET';

            if (channel !== 'ALL' && channel !== ch) continue;

            const isMatched = row.p_status === 'SUCCESS' && row.b_status === 'PAID';
            items.push({
                id: row.payment_id,
                bookingCode: row.booking_code,
                channel: ch,
                transId: row.transaction_code,
                orderAmount: parseFloat(row.order_amount),
                receivedAmount: parseFloat(row.received_amount),
                gatewayStatus: row.p_status === 'REFUNDED' ? 'AUTO_REFUNDED' : (isMatched ? 'MATCHED' : 'PENDING'),
                reconciliationStatus: isMatched ? 'MATCHED' : (row.p_status === 'FAILED' ? 'DISCREPANCY' : 'PENDING'),
                notes: isMatched ? 'Giao dịch đối soát khớp tự động 100%.' : 'Cần đối chiếu sao kê tài khoản nhận.',
                createdAt: new Date(row.created_at).toISOString(),
                companyName: row.company_name,
                memberName: row.member_name
            });
        }

        // Hợp nhất Tiền mặt tại quầy & Thống kê theo ngày
        let totalCashIn = 0;
        let totalCashOut = 0;
        const dailyCashMap = new Map<string, DailyCashSummaryItem>();

        for (const row of cashRes.rows) {
            const amount = parseFloat(row.amount);
            const dateStr = row.shift_date ? String(row.shift_date).slice(0, 10) : new Date(row.created_at).toISOString().slice(0, 10);

            if (!dailyCashMap.has(dateStr)) {
                dailyCashMap.set(dateStr, {
                    date: dateStr,
                    cashInAmount: 0,
                    cashInCount: 0,
                    cashOutAmount: 0,
                    cashOutCount: 0,
                    netAmount: 0
                });
            }
            const dayStat = dailyCashMap.get(dateStr)!;

            if (row.entry_type === 'CASH_IN_COLLECT') {
                totalCashIn += amount;
                dayStat.cashInAmount += amount;
                dayStat.cashInCount += 1;
            } else {
                totalCashOut += amount;
                dayStat.cashOutAmount += amount;
                dayStat.cashOutCount += 1;
            }
            dayStat.netAmount = dayStat.cashInAmount - dayStat.cashOutAmount;

            if (channel === 'ALL' || channel === 'CASH') {
                const isCollect = row.entry_type === 'CASH_IN_COLLECT';
                items.push({
                    id: row.cash_id,
                    bookingCode: row.booking_code,
                    channel: 'CASH',
                    transId: `CSH_${row.cash_id.slice(-8)}`,
                    orderAmount: amount,
                    receivedAmount: isCollect ? amount : -amount,
                    gatewayStatus: isCollect ? 'MATCHED' : 'AUTO_REFUNDED',
                    reconciliationStatus: 'MATCHED',
                    notes: `${row.notes} (Thu/chi bởi: ${row.staff_name}${row.supervisor_name ? `, Duyệt OTP: ${row.supervisor_name}` : ''})`,
                    verifiedBy: row.supervisor_name || row.staff_name,
                    createdAt: new Date(row.created_at).toISOString()
                });
            }
        }

        // Hợp nhất Hạn mức doanh nghiệp
        let totalQuotaCreditAmount = 0;
        for (const row of quotaRes.rows) {
            const amount = parseFloat(row.amount);
            if (row.quota_type === 'CREDIT' && row.tx_type === 'CONSUME') {
                totalQuotaCreditAmount += amount;
            }

            if (channel === 'ALL' || channel === 'CORPORATE_QUOTA') {
                items.push({
                    id: row.ledger_id,
                    bookingCode: row.booking_code || 'BKG-CORP-QUOTA',
                    channel: 'CORPORATE_QUOTA',
                    transId: `QTA_${row.ledger_id.slice(-8)}`,
                    orderAmount: amount,
                    receivedAmount: amount,
                    gatewayStatus: row.tx_type === 'RELEASE' ? 'AUTO_REFUNDED' : 'MATCHED',
                    reconciliationStatus: 'MATCHED',
                    notes: `${row.reason} [${row.quota_type}] (${row.company_name})`,
                    createdAt: new Date(row.created_at).toISOString(),
                    companyName: row.company_name,
                    memberName: row.member_name
                });
            }
        }

        // Tính tổng doanh thu theo các kênh
        let totalOnline = 0;
        let totalWallet = 0;
        for (const it of items) {
            if (it.channel === 'MOMO' || it.channel === 'VNPAY') totalOnline += it.receivedAmount;
            if (it.channel === 'WALLET') totalWallet += it.receivedAmount;
        }

        const totalRevenue = totalOnline + totalWallet + totalCashIn + totalQuotaCreditAmount;
        const dailyCashSummary = Array.from(dailyCashMap.values()).sort((a, b) => b.date.localeCompare(a.date));

        return {
            from,
            to,
            startTs: startIso,
            endTs: endIso,
            summary: {
                totalRevenue,
                totalOnlineAmount: totalOnline,
                totalWalletAmount: totalWallet,
                totalCashAmount: totalCashIn,
                totalQuotaCreditAmount,
                totalTransactions: items.length
            },
            cashDrawer: {
                totalCashIn,
                totalCashOut,
                netCashInDrawer: totalCashIn - totalCashOut,
                transactionCount: cashRes.rows.length
            },
            dailyCashSummary,
            items
        };
    }
}

