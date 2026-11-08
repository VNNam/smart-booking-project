# BA/SA Analysis & Hardening Progress Log (Complete Milestone)

> File theo dõi tiến độ phân tích, thiết kế và triển khai 3 module: B2B Quota, Calendar Logic, Finance & Reconciliation.

## 1. Giai đoạn Phân tích & Đánh giá (Analysis & Review) - HOÀN TẤT 100%
| # | Task | Output | Status |
|---|------|--------|--------|
| 1 | Phân tích usecase "Member đặt phòng tương lai → trừ hạn mức → kế toán đối soát theo khoảng ngày" | `01-requirements/ba_quota_booking_reconciliation_analysis.md` | DONE |
| 2 | Gap analysis ERD / API / code so với 3 module | `02-architecture/gap_analysis_b2b_quota_finance.md` | DONE |
| 3 | Review `frontend/admin/pages/cash-booking.tsx` theo rule chặn khung giờ quá khứ | `04-testing/review_cash_booking_calendar.md` | DONE |

## 2. Giai đoạn Khắc phục Lỗi Nghiêm Trọng (S1 Defect Fixes) - HOÀN TẤT 100%
| # | Fix | Files | Status |
|---|-----|-------|--------|
| F1 | Util múi giờ VN + tính giá server (`computeBookingAmount`, `toVnDayRange`) + 11 unit tests | `src/utils/businessTime.ts`, `test/utils/businessTime.test.ts` | DONE |
| F2 | CB-04/G-14: server guard slot quá khứ + slot không AVAILABLE; CB-09 giá cuối tuần ở server | `src/services/BookingService.ts` | DONE |
| F3 | CB-01/02/03/07/09/10/11: cash-booking FE (bỏ mock success, tick thời gian 30s, re-validate submit, idempotency key theo slot, dùng amount server, token thật) | `frontend/admin/pages/cash-booking.tsx` | DONE |
| F4 | G-18/G-16/G-19: accounting date range (ngày VN, from<=to, áp dụng cho cả tab Sổ quỹ tiền mặt) | `frontend/admin/pages/admin/accounting.tsx` | DONE |
| F5 | Build verify (`tsc`, `jest test/utils`, `next build`) | Toàn bộ hệ thống | DONE |

## 3. Giai đoạn Triển khai Kiến trúc V1.5 (B2B Quota & Advanced Reconciliation) - HOÀN TẤT 100%
| # | Hạng mục | Files | Status |
|---|----------|-------|--------|
| M1 | Migration CSDL v1.5: `member_quotas`, `quota_ledger`, mở rộng `companies` (contact/hợp đồng), `bookings.actual_check_*`, enum `CORPORATE_QUOTA` & `ACCOUNTANT`, index hiệu năng | `src/database/schema_v1.5_corporate_quota.sql`, `src/database/schema_v1.sql`, `02-architecture/database_erd.md` | DONE |
| M2 | `QuotaService`: Pessimistic locking (FOR UPDATE), kiểm tra hạn mức CREDIT / BOOKINGS / HOURS, trần tín dụng công ty, hoàn trả hạn mức khi hủy phòng, điều chỉnh hạn mức và lịch sử sử dụng | `src/services/QuotaService.ts`, `test/services/quota_accounting.test.ts` | DONE |
| M3 | Tích hợp luồng `CORPORATE_QUOTA` vào `BookingService`: Đặt phòng trừ quota, hủy phòng hoàn trả quota tự động | `src/services/BookingService.ts` | DONE |
| M4 | `AccountingService`: Lọc đối soát hợp nhất theo khoảng ngày [Từ ngày] - [Đến ngày] (Payments, Bookings, Quota Ledger, Cash Book Logs) | `src/services/AccountingService.ts`, `test/services/quota_accounting.test.ts` | DONE |
| M5 | Đồng bộ OpenAPI / Contract API B2B và Kế toán | `02-architecture/api_contracts/booking_api.yaml` | DONE |
| M6 | Nâng cấp Web Admin Hạn mức Doanh nghiệp (`corporate-debts.tsx`) áp dụng Member Quota Guard cho cả 3 loại hạn mức | `frontend/admin/pages/corporate-debts.tsx` | DONE |
| M7 | Toàn bộ kiểm thử unit test & biên dịch Next.js (12/12 static pages) | `test/`, `frontend/admin/` | DONE |

## 4. Giai đoạn Khắc phục Lỗi 400 Thu tiền mặt & Liên kết B2B (Walk-in Cash & Dynamic Slots) - HOÀN TẤT 100%
| # | Hạng mục | Files | Status |
|---|----------|-------|--------|
| C1 | Trích xuất Custom Errors dùng chung (`BusinessErrors.ts`) triệt tiêu lỗi CommonJS circular dependency giữa BookingService và QuotaService | `src/errors/BusinessErrors.ts`, `src/services/BookingService.ts`, `src/services/QuotaService.ts` | DONE |
| C2 | Mở rộng DTO & Xử lý Slot động (`BookingService.ts`): Hỗ trợ `bookingDate`, `startTime`, `endTime`, `companyId`, `memberId`; Tự động tra cứu hoặc sinh slot mới thay vì crash 400 / 22P02 khi nhận synthetic slot ID; Gán user_id thành viên và liên kết công nợ | `src/services/BookingService.ts` | DONE |
| C3 | Nâng cấp UI Thu tiền mặt (`cash-booking.tsx`): Thêm bộ chọn Loại khách hàng (Vãng lai vs Doanh nghiệp/Thành viên), dropdown Công ty & Thành viên, đóng gói đầy đủ `bookingDate`, `startTime`, `endTime`, `companyId`, `memberId` vào payload | `frontend/admin/pages/cash-booking.tsx` | DONE |
| C4 | Viết và kiểm thử thành công bộ Unit Test (`cash_booking_walkin.test.ts`): Bao phủ TC-CASH-01 (Happy path & SlotInPastError) và TC-CASH-02 (Corporate Member Linkage & Dynamic Slot Allocation) | `test/services/cash_booking_walkin.test.ts` | DONE |
| C5 | Kiểm thử toàn diện hệ thống: 20/20 unit tests pass, Next.js production build 12/12 routes pass | `test/`, `frontend/admin/` | DONE |

## Log
- [2026-11-08 16:32] Khởi tạo. Đã đọc: `database_erd.md`, `src/database/schema_v1.sql`, tail audit log.
- [2026-11-08 16:34] Task 1 DONE. Phân tích ngữ cảnh B2B Quota & Date Range.
- [2026-11-08 16:35] Task 2 DONE. Lập bảng đối chiếu lỗ hổng Gap Analysis.
- [2026-11-08 16:36] Task 3 DONE. Rà soát 4 lỗi S1 trong luồng thu tiền mặt.
- [2026-11-08 16:51] Giai đoạn 2 DONE (F1-F5). Khắc phục toàn bộ 4 lỗi S1.
- [2026-11-08 17:10] Giai đoạn 3 DONE (M1-M7). Hoàn tất toàn bộ kiến trúc B2B Quota, Calendar Guard và Đối soát Kế toán đa nguồn v1.5.
- [2026-11-08 17:30] Giai đoạn 4 DONE (C1-C5). Khắc phục triệt để lỗi 400 Bad Request luồng Thu tiền mặt tại quầy, hỗ trợ slot động và liên kết thành viên B2B, pass 20/20 unit tests và Next.js build.
