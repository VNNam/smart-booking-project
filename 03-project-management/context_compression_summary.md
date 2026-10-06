# MASTER CONTEXT COMPRESSION SUMMARY (v1.4)
**Project:** Smart Meeting Room Booking System  
**Created At:** 2026-10-06  
**Status:** Sprint 1 COMPLETED (100%) -> Sprint 2 IN PROGRESS  
**Purpose:** Bản nén ngữ cảnh toàn diện, lưu trữ toàn bộ quy tắc nghiệp vụ cốt lõi, kiến trúc kỹ thuật và tiến độ thực thi để làm điểm tựa khởi động lại session bất kỳ lúc nào mà không suy giảm thông tin.

---

## 1. Bối Cảnh Dự Án & Mục Tiêu (Project Context & Objectives)
*   **Tên dự án:** Smart Meeting Room Booking System (Hệ thống Đặt Phòng Họp Thông Minh).
*   **Mục tiêu:** Giải quyết triệt để vấn đề xung đột lịch (Double-booking), phòng trống ảo (Ghost bookings) và găm phòng đầu cơ. Cung cấp trải nghiệm đặt phòng di động < 60 giây và tự động hóa 100% đối soát tài chính đa phương thức.
*   **Công nghệ cốt lõi:**
    *   *Backend:* Node.js (TypeScript) / PostgreSQL 16 / Redis 7 Cluster / RabbitMQ Message Broker.
    *   *Frontend:* Next.js (Web Admin cho Lễ tân, Quản lý ca, Kế toán) & Mobile App (Khách vãng lai, Thành viên).

---

## 2. Quy Tắc Nghiệp Vụ Cốt Lõi (Core Business Rules v1.4)

### 2.1. Bốn Luồng Thanh Toán (Multi-Payment System)
1.  **Online Payment (Khách vãng lai - Mobile App):**
    *   Thời gian giữ chỗ: **10 phút (600 giây)**. Trạng thái: `LOCKED_PENDING_ONLINE`.
    *   *Late Webhook Handling:* Nếu Webhook VNPAY/MoMo gửi kết quả thành công sau 10 phút mà phòng đã bị khách khác chiếm chỗ $\to$ **Saga Orchestrator** tự động kích hoạt `RefundWorker` gọi API hoàn tiền 100% (Auto-Refund) cho khách cũ, tuyệt đối không đè trạng thái phòng của khách mới.
2.  **Ví Thành Viên (Prepaid Credit - Mobile App):**
    *   Trừ tiền tức thì bằng **Pessimistic Locking (`SELECT ... FOR UPDATE`)**, không cần thời gian chờ (No TTL).
    *   Ràng buộc CSDL: `CONSTRAINT chk_wallet_non_negative CHECK (balance >= 0.00)`.
    *   Bắt buộc header `Idempotency-Key` (UUIDv4) để triệt tiêu tấn công tiêu âm ví (Double-Spending).
3.  **Tiền Mặt Tại Quầy (Walk-in Cash - Web Admin):**
    *   Chỉ dành riêng cho Quản lý / Lễ tân trên Web Admin (Chặn khách hàng 403 Forbidden).
    *   Trạng thái: `CONFIRMED_PAID`, tự động sinh bản ghi thu tiền `CASH_IN_COLLECT` trong bảng `CASH_BOOK_LOGS`.
4.  **Công Nợ Doanh Nghiệp (Postpaid Debt - Web Admin):**
    *   Chỉ dành cho Lễ tân/Quản lý đặt cho khách VIP / công ty đối tác.
    *   Kiểm soát hạn mức tín dụng nghiêm ngặt: $current\_debt + room\_price \le credit\_limit$. Vượt hạn mức $\to$ Báo lỗi HTTP 422 `CREDIT_LIMIT_EXCEEDED`.

### 2.2. Chính Sách Hủy Phòng & Hoàn Tiền Đa Tầng (Multi-tiered Cancellation)
*   **Hủy trước $\ge 24$ giờ:** Hoàn **100%** tiền cọc / số dư ví.
*   **Hủy từ 2 giờ đến dưới 24 giờ:** Phạt **20%** phí giữ phòng, chỉ hoàn lại **80%**.
*   **Hủy dưới 2 giờ:** Phạt **100%** (Hoàn **0%**, trạng thái `CANCELLED_NO_REFUND`).
*   **Giới hạn chống găm phòng đầu cơ:** Mỗi tài khoản chỉ được miễn phạt tối đa 2 lần/tháng. Lần thứ 3 trở đi phạt cố định **30%** bất kể thời gian hủy trước bao lâu.
*   **Two-Man Rule (Hoàn tiền mặt):** Lễ tân bấm "Hủy & Hoàn tiền mặt" bắt buộc phải nhập mã **OTP xác thực từ Quản lý ca trực (Shift Supervisor)** mới được sinh phiếu chi `CASH_OUT_REFUND` vào sổ quỹ.

---

## 3. Kiến Trúc Kỹ Thuật & CSDL Đã Hiện Thực Hóa (Sprint 1 Artifacts)

### 3.1. CSDL PostgreSQL 16 ([src/database/schema_v1.sql](file:///home/nam/smart-booking-project/smart-booking-project/src/database/schema_v1.sql))
*   **Partial Unique Index Chống Double-Booking:**
    ```sql
    CREATE UNIQUE INDEX idx_unique_active_meeting_slot 
    ON bookings (slot_id) 
    WHERE booking_status NOT IN ('CANCELLED', 'CANCELLED_NO_REFUND', 'EXPIRED', 'EXPIRED_REFUNDED');
    ```
*   **Transactional Outbox Pattern:**
    Bảng `outbox_events` kèm chỉ mục `idx_outbox_events_pending` giúp Relay Worker đẩy message vào RabbitMQ với cam kết At-least-once delivery, không bao giờ mất thông báo hay mã QR khi sập server.
*   **Stored Function `deduct_member_wallet()`:** Thực thi Pessimistic Lock và kiểm tra Idempotency nguyên tử.

### 3.2. Middleware ([src/middleware/idempotency.ts](file:///home/nam/smart-booking-project/smart-booking-project/src/middleware/idempotency.ts))
*   Validate header `Idempotency-Key` (UUIDv4) trên request POST/PATCH.
*   Redis atomic lock `IN_PROGRESS` (30s) chống concurrent click (trả về 409 Conflict).
*   Cache Hit 24 giờ (`COMPLETED`) trả về response ngay lập tức kèm header `X-Cache-Lookup: HIT-IDEMPOTENT`.

### 3.3. Bộ Kiểm Thử Concurrency ([test/sprint1/db_locks.test.ts](file:///home/nam/smart-booking-project/smart-booking-project/test/sprint1/db_locks.test.ts))
*   Pass 100% kiểm thử 2 request song song trừ ví 5ms (chỉ 1 đơn được duyệt, ví không âm).
*   Pass kiểm thử Partial Unique Index (Postgres 23505 Unique Violation) khi đặt trùng slot.
*   Pass kiểm thử chặn công nợ vượt hạn mức tín dụng và kiểm thử Rollback Outbox.

---

## 4. Trạng Thái Thực Thi & Kế Hoạch Các Sprint (Execution State)

| Sprint | Hạng mục cốt lõi | Trạng thái |
|---|---|:---:|
| **Sprint 1** | CSDL PostgreSQL 16 ([schema_v1.sql](file:///home/nam/smart-booking-project/smart-booking-project/src/database/schema_v1.sql)), Idempotency Middleware ([idempotency.ts](file:///home/nam/smart-booking-project/smart-booking-project/src/middleware/idempotency.ts)), QA Concurrency Tests ([db_locks.test.ts](file:///home/nam/smart-booking-project/smart-booking-project/test/sprint1/db_locks.test.ts)) | **COMPLETED (100%)** |
| **Sprint 2** | [BookingService.ts](file:///home/nam/smart-booking-project/smart-booking-project/src/services/BookingService.ts) (Redis Lock 10m, Wallet, Cash), [PaymentWebhookService.ts](file:///home/nam/smart-booking-project/smart-booking-project/src/services/PaymentWebhookService.ts) (Saga Auto-Refund), QA Webhook Saga ([webhook_saga.test.ts](file:///home/nam/smart-booking-project/smart-booking-project/test/sprint2/webhook_saga.test.ts)) | **COMPLETED (100%)** |
| **Sprint 3** | Frontend Web Admin Walk-in ([cash-booking.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/admin/pages/cash-booking.tsx)), Two-Man Rule OTP Popup ([RefundModal.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/admin/components/RefundModal.tsx)), QA Cypress E2E ([admin_cash_refund.cy.ts](file:///home/nam/smart-booking-project/smart-booking-project/test/e2e/admin_cash_refund.cy.ts)) | **COMPLETED (100%)** |
| **Sprint 3.5** | Web Admin Grid ([CalendarGrid.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/admin/components/CalendarGrid.tsx)), Corporate Debt ([corporate-debts.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/admin/pages/corporate-debts.tsx)), Mobile App ([RoomSearchScreen.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/mobile/src/screens/RoomSearchScreen.tsx), [RoomDetailScreen.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/mobile/src/screens/RoomDetailScreen.tsx), [CheckoutScreen.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/mobile/src/screens/CheckoutScreen.tsx), [CountdownTimer.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/mobile/src/components/CountdownTimer.tsx), [BookingHistoryScreen.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/mobile/src/screens/BookingHistoryScreen.tsx), [CancelBookingScreen.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/mobile/src/screens/CancelBookingScreen.tsx)), QA Frontend ([frontend_integration.test.ts](file:///home/nam/smart-booking-project/smart-booking-project/test/frontend/frontend_integration.test.ts)) | **COMPLETED (100%)** |


---
*Snapshot được biên tập và lưu trữ chính thức tại thư mục quản trị dự án.*
