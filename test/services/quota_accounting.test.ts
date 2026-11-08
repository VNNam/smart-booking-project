/**
 * Unit Tests: QuotaService & AccountingService
 * Bao phủ:
 * - TC-Q01: Consume Quota within limit
 * - TC-Q02: Quota exceeded guard (CREDIT / BOOKINGS / HOURS)
 * - TC-Q04: Company Credit Limit check
 * - TC-Q07: Release Quota on valid cancellation
 * - TC-F01/F04: Multi-source Reconciliation by Date Range
 */

import { QuotaService, MemberQuotaExceededError } from '../../src/services/QuotaService';
import { AccountingService } from '../../src/services/AccountingService';

describe('QuotaService & AccountingService Unit Tests', () => {
    let mockPool: any;
    let mockClient: any;
    let quotaService: QuotaService;
    let accountingService: AccountingService;

    beforeEach(() => {
        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient),
            query: jest.fn()
        };
        quotaService = new QuotaService(mockPool);
        accountingService = new AccountingService(mockPool);
    });

    describe('QuotaService - checkAndConsumeQuota', () => {
        it('TC-Q01: Tiêu hao hạn mức thành công khi trong giới hạn', async () => {
            // Mock company query
            mockClient.query
                .mockResolvedValueOnce({
                    rows: [{ id: 'c-1', name: 'Global Corp', credit_limit: '50000000', current_debt: '10000000', is_active: true }]
                })
                // Mock member_quotas query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            id: 'q-1',
                            user_id: 'u-1',
                            company_id: 'c-1',
                            quota_type: 'HOURS',
                            quota_limit: '30.00',
                            quota_used: '18.00',
                            period_start: '2026-11-01',
                            period_end: '2026-11-30',
                            is_active: true
                        }
                    ]
                })
                // Mock UPDATE member_quotas
                .mockResolvedValueOnce({ rowCount: 1 })
                // Mock INSERT quota_ledger
                .mockResolvedValueOnce({ rowCount: 1 });

            const result = await quotaService.checkAndConsumeQuota(mockClient, {
                userId: 'u-1',
                companyId: 'c-1',
                bookingId: 'b-1',
                slotStartTime: '2026-11-12T13:00:00Z',
                slotEndTime: '2026-11-12T15:00:00Z', // 2 hours
                totalAmount: 700000,
                idempotencyKey: 'idem-1'
            });

            expect(result.success).toBe(true);
            expect(result.consumed.HOURS).toBe(2);
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE member_quotas'),
                [20, 'q-1'] // 18 + 2 = 20
            );
        });

        it('TC-Q02: Chặn đặt phòng khi vượt hạn mức thành viên (MemberQuotaExceededError)', async () => {
            mockClient.query
                .mockResolvedValueOnce({
                    rows: [{ id: 'c-1', name: 'Global Corp', credit_limit: '50000000', current_debt: '10000000', is_active: true }]
                })
                .mockResolvedValueOnce({
                    rows: [
                        {
                            id: 'q-2',
                            user_id: 'u-2',
                            company_id: 'c-1',
                            quota_type: 'BOOKINGS',
                            quota_limit: '12.00',
                            quota_used: '12.00', // Đã chạm trần
                            period_start: '2026-11-01',
                            period_end: '2026-11-30',
                            is_active: true
                        }
                    ]
                });

            await expect(
                quotaService.checkAndConsumeQuota(mockClient, {
                    userId: 'u-2',
                    companyId: 'c-1',
                    bookingId: 'b-2',
                    slotStartTime: '2026-11-12T13:00:00Z',
                    slotEndTime: '2026-11-12T15:00:00Z',
                    totalAmount: 700000,
                    idempotencyKey: 'idem-2'
                })
            ).rejects.toThrow(MemberQuotaExceededError);
        });

        it('TC-Q04: Chặn khi nợ toàn công ty vượt trần tín dụng (Company Credit Limit)', async () => {
            mockClient.query
                .mockResolvedValueOnce({
                    rows: [{ id: 'c-1', name: 'Global Corp', credit_limit: '20000000', current_debt: '19500000', is_active: true }]
                })
                .mockResolvedValueOnce({
                    rows: [
                        {
                            id: 'q-3',
                            user_id: 'u-3',
                            company_id: 'c-1',
                            quota_type: 'CREDIT',
                            quota_limit: '15000000',
                            quota_used: '5000000', // Member còn đủ
                            period_start: '2026-11-01',
                            period_end: '2026-11-30',
                            is_active: true
                        }
                    ]
                });

            await expect(
                quotaService.checkAndConsumeQuota(mockClient, {
                    userId: 'u-3',
                    companyId: 'c-1',
                    bookingId: 'b-3',
                    slotStartTime: '2026-11-12T13:00:00Z',
                    slotEndTime: '2026-11-12T15:00:00Z',
                    totalAmount: 1000000, // 19.5M + 1M = 20.5M > 20M
                    idempotencyKey: 'idem-3'
                })
            ).rejects.toThrow('Tổng công nợ công ty vượt hạn mức tín dụng');
        });
    });

    describe('QuotaService - releaseQuota', () => {
        it('TC-Q07: Hoàn trả hạn mức và ghi sổ cái RELEASE', async () => {
            mockClient.query
                // Query consumed entries
                .mockResolvedValueOnce({
                    rows: [
                        {
                            id: 'led-1',
                            member_quota_id: 'q-1',
                            user_id: 'u-1',
                            company_id: 'c-1',
                            amount: '2.00',
                            tx_type: 'CONSUME'
                        }
                    ]
                })
                // Query member_quota for update
                .mockResolvedValueOnce({
                    rows: [{ id: 'q-1', quota_used: '20.00', quota_type: 'HOURS', period_start: '2026-11-01' }]
                })
                // UPDATE member_quotas
                .mockResolvedValueOnce({ rowCount: 1 })
                // INSERT quota_ledger (RELEASE)
                .mockResolvedValueOnce({ rowCount: 1 });

            const result = await quotaService.releaseQuota(mockClient, 'b-1', 'Hủy phòng trước 24h');
            expect(result.released).toBe(true);
            expect(result.entriesRestored).toBe(1);
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE member_quotas'),
                [18, 'q-1'] // 20 - 2 = 18
            );
        });
    });

    describe('AccountingService - getReconciliationReport', () => {
        it('TC-F04: Lọc đối soát hợp nhất theo khoảng ngày và tính sổ quỹ tiền mặt', async () => {
            // Mock payments query
            mockPool.query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            payment_id: 'pay-1',
                            booking_id: 'b-1',
                            booking_code: 'BKG-MOMO-01',
                            gateway: 'MOMO',
                            transaction_code: 'MOMO_112233',
                            order_amount: '650000',
                            received_amount: '650000',
                            p_status: 'SUCCESS',
                            b_status: 'PAID',
                            payment_method: 'ONLINE_GATEWAY',
                            created_at: '2026-11-08T02:15:00Z'
                        }
                    ]
                })
                // Mock cash_book_logs query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            cash_id: 'cb-1',
                            booking_id: 'b-2',
                            booking_code: 'BKG-WALK-02',
                            entry_type: 'CASH_IN_COLLECT',
                            amount: '700000',
                            notes: 'Thu tiền mặt tại quầy',
                            shift_date: '2026-11-08',
                            created_at: '2026-11-08T03:00:00Z',
                            staff_name: 'Lễ Tân Ca Trực',
                            supervisor_name: null
                        },
                        {
                            cash_id: 'cb-2',
                            booking_id: 'b-3',
                            booking_code: 'BKG-WALK-03',
                            entry_type: 'CASH_OUT_REFUND',
                            amount: '200000',
                            notes: 'Hoàn tiền mặt 80%',
                            shift_date: '2026-11-08',
                            created_at: '2026-11-08T04:00:00Z',
                            staff_name: 'Lễ Tân Ca Trực',
                            supervisor_name: 'Quản Lý Trực'
                        }
                    ]
                })
                // Mock quota_ledger query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            ledger_id: 'ql-1',
                            booking_code: 'BKG-CORP-04',
                            company_name: 'Global Corp',
                            member_name: 'Thành viên VIP',
                            amount: '1200000',
                            tx_type: 'CONSUME',
                            reason: 'Tiêu hao hạn mức CREDIT',
                            created_at: '2026-11-08T05:00:00Z',
                            quota_type: 'CREDIT'
                        }
                    ]
                });

            const report = await accountingService.getReconciliationReport({
                from: '2026-11-01',
                to: '2026-11-08'
            });

            expect(report.from).toBe('2026-11-01');
            expect(report.to).toBe('2026-11-08');
            expect(report.summary.totalTransactions).toBe(4); // 1 momo + 2 cash + 1 quota
            expect(report.cashDrawer.totalCashIn).toBe(700000);
            expect(report.cashDrawer.totalCashOut).toBe(200000);
            expect(report.cashDrawer.netCashInDrawer).toBe(500000);
            expect(report.summary.totalQuotaCreditAmount).toBe(1200000);
            expect(report.dailyCashSummary).toHaveLength(1);
            expect(report.dailyCashSummary[0]).toEqual({
                date: '2026-11-08',
                cashInAmount: 700000,
                cashInCount: 1,
                cashOutAmount: 200000,
                cashOutCount: 1,
                netAmount: 500000
            });
        });
    });
});

