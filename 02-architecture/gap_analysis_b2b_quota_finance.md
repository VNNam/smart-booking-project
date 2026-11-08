# Gap Analysis — ERD / API / Code vs. 3 Core Modules

**Ngày:** 2026-11-08 · **Commit tham chiếu:** `a786814`
**Phương pháp:** đối chiếu yêu cầu Module 1–3 với `database_erd.md`, `src/database/schema_v1.sql`, `src/services/BookingService.ts`, `api_contracts/*.yaml`, `frontend/admin/pages/*`.
**Thiết kế đích:** xem `01-requirements/ba_quota_booking_reconciliation_analysis.md`.

> [!IMPORTANT]
> Kết luận chính: các tính năng Module 1 và Module 3 hiện **chỉ có ở tầng UI mock** (state React / LocalStorage). Backend, schema và API contract **chưa có**. Trạng thái "UAT READY" trong `context_compression_summary.md` không đúng cho các module này.

## Legend
`✅ Có` · `🟡 Một phần / chỉ mock UI` · `❌ Chưa có` · Severity: **S1** chặn nghiệp vụ / sai tiền · **S2** sai logic · **S3** cải tiến

---

## Module 1 — Quản lý Doanh nghiệp & Thành viên

| ID | Yêu cầu | DB | API | Backend | UI | Sev | Ghi chú |
|---|---|---|---|---|---|---|---|
| G-01 | Tạo công ty: MST, liên hệ, chính sách giá/hợp đồng | 🟡 chỉ có `name, tax_code, credit_limit` | ❌ không có `/companies` | ❌ | 🟡 `corporate-debts.tsx` state | S1 | Thiếu contact, contract, `pricing_policy_id` |
| G-02 | Thêm member liên kết `company_id` | ✅ `users.company_id` FK | ❌ | ❌ | 🟡 mock | S2 | FK `ON DELETE SET NULL` → xóa công ty làm mất liên kết lịch sử; đề xuất `RESTRICT` + soft delete |
| G-03 | Hạn mức CREDIT / BOOKINGS / HOURS theo member | ❌ (chỉ `users.credit_limit` cho VIP cá nhân) | ❌ | ❌ | 🟡 mock `quotaType` | S1 | Cần bảng `member_quotas` |
| G-04 | Reset tự động tuần/tháng + cập nhật thủ công | ❌ | ❌ | ❌ không có scheduler | 🟡 chỉ lưu `resetCycle` | S1 | Cần job + ledger `RESET` |
| G-05 | Chặn khi vượt hạn mức → từ chối / fallback cash | ❌ | ❌ | 🟡 chỉ check **company** `credit_limit` trong luồng `POSTPAID_DEBT` | 🟡 mock chỉ check CREDIT; **BOOKINGS/HOURS không check** (chỉ dựa `status==='SUSPENDED'`) | S1 | Luồng `POSTPAID_DEBT` chỉ cho STAFF/ADMIN — **member không tự đặt bằng quota được** |
| G-06 | Lịch sử sử dụng: đặt/hủy, check-in/out thực tế, quota tiêu hao | ❌ không có `actual_check_in/out`, không có ledger | ❌ | ❌ | 🟡 mock `MemberUsageLog` (ghi cứng "14:00 - 16:00", "Vừa check-in") | S1 | |
| G-07 | Vai trò Kế toán | ❌ `user_role_enum` không có `ACCOUNTANT` | — | — | 🟡 `userStore` có "Kế toán" | S2 | RBAC không phân tách được quyền đối soát |
| G-08 | Mock tăng quota sai đơn vị | — | — | — | 🟡 HOURS cộng `+1` thay vì số giờ thực | S2 | `corporate-debts.tsx` L372 |
| G-09 | Sửa limit < used | — | — | — | 🟡 tự set `SUSPENDED` | S3 | Cần ledger `ADJUST` + audit `performed_by` |

## Module 2 — Tra cứu lịch phòng trống

| ID | Yêu cầu | Hiện trạng | Sev | Ghi chú |
|---|---|---|---|---|
| G-10 | API tra cứu slot trống theo ngày | 🟡 chỉ có `/slots/available` trong `openapi.yaml` (theo `service_id`, contract cũ); `booking_api.yaml` không có | S2 | Hai contract lệch nhau |
| G-11 | Ngày hiện tại: chỉ slot `start_time > now()` | 🟡 chỉ lọc ở **client** (`cash-booking.tsx`) bằng giờ máy trình duyệt | S1 | Backend không có query lọc |
| G-12 | Ngày tương lai: toàn bộ slot chưa đặt | 🟡 client sinh slot giả lập, không đọc `slots` thật | S2 | |
| G-13 | Chuẩn timezone | ❌ không cấu hình `Asia/Ho_Chi_Minh` ở DB/app (grep không thấy) | S1 | Ranh giới "hôm nay" và "ngày ca" lệch nếu server chạy UTC |

## Module 3 — Kế toán, Đối soát & Thu tiền mặt

| ID | Yêu cầu | Hiện trạng | Sev | Ghi chú |
|---|---|---|---|---|
| G-14 | Không thu tiền mặt cho khung giờ đã qua (server) | ❌ `createBooking` **không kiểm tra** `start_time > now()` và **không dùng** `slot_status` đã SELECT (L151) | **S1** | Gọi API trực tiếp vẫn thu tiền cho slot quá khứ |
| G-15 | Cập nhật trạng thái phòng lập tức | ✅ cùng transaction `UPDATE slots BOOKED` + partial unique index | — | Nhưng không `SELECT ... FOR UPDATE` slot trước → phụ thuộc hoàn toàn unique index (chấp nhận được) |
| G-16 | Date Range Picker `[Từ]-[Đến]` | 🟡 có ở `admin/accounting.tsx` (tab Đối soát) | S2 | Default cứng `2026-11-01`→`2026-11-08`; không `min/max` ràng buộc `from<=to` |
| G-17 | Lọc inclusive cả 2 đầu | 🟡 so sánh chuỗi `YYYY-MM-DD` trên mock — đúng logic | S2 | Không có API backend thực hiện |
| G-18 | Nút nhanh "Hôm nay / 7 ngày" dùng `toISOString()` | ❌ bug | S2 | 00:00–06:59 giờ VN trả về **ngày hôm qua** (UTC) |
| G-19 | Lọc phải gồm: giao dịch, hóa đơn, lượt dùng hạn mức, thu tiền mặt | ❌ chỉ lọc `reconciliations`; tab **Sổ quỹ tiền mặt không áp dụng bộ lọc** (dữ liệu chỉ có `time`, không có ngày); không có nguồn quota | S1 | |
| G-20 | API đối soát | ❌ không có `/accounting/*` trong contract | S1 | |
| G-21 | `cash_book_logs.shift_date = CURRENT_DATE` | 🟡 phụ thuộc timezone session DB | S2 | Liên quan G-13 |
| G-22 | Index lọc theo thời gian | ❌ thiếu index `created_at` trên `bookings` (chỉ có composite với `user_id`), `payments`, `cash_book_logs` | S3 | |

---

## Backlog đề xuất (theo thứ tự ưu tiên)

| # | Hạng mục | Gap | Ước lượng |
|---|---|---|---|
| 1 | Server-side guard: `status='AVAILABLE' AND start_time > now()` trong `createBooking` (mọi payment method) | G-14, G-11 | 0.5d |
| 2 | Chuẩn timezone: `ALTER DATABASE ... SET timezone='Asia/Ho_Chi_Minh'`, util `toVnDayRange(from,to)` dùng chung FE/BE | G-13, G-18, G-21 | 1d |
| 3 | Migration V1.5: `member_quotas`, `quota_ledger`, mở rộng `companies`, `bookings.actual_check_*`, enum `CORPORATE_QUOTA`, `ACCOUNTANT`, index | G-01..07, G-22 | 1.5d |
| 4 | `QuotaService.checkAndConsume/release` + luồng `CORPORATE_QUOTA` cho MEMBER (mobile) | G-05 | 2d |
| 5 | Scheduler reset quota (idempotent) | G-04 | 1d |
| 6 | API `/companies`, `/companies/{id}/members`, `/members/{id}/quotas`, `/members/{id}/usage-history` | G-01, G-02, G-06 | 2d |
| 7 | API `/slots/available?roomId&date` hợp nhất contract | G-10, G-12 | 1d |
| 8 | API `/accounting/transactions?from&to&channel` gom 4 nguồn; FE thay mock, áp bộ lọc cho mọi tab | G-16, G-19, G-20 | 2d |
| 9 | Check-in/check-out + overtime quota | G-06 | 1.5d |
| 10 | Cập nhật ERD, BRD v1.5, BDD features (`corporate_quota.feature`, `accounting_date_range.feature`) | — | 1d |

**Tổng ước lượng:** ~13.5 man-day.

