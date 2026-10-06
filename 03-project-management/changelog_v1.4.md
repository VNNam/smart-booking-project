# Nhật Ký Thay Đổi & Nâng Cấp Hệ Thống (Changelog v1.4)
**Dự án:** Smart Meeting Room Booking System  
**Ngày phát hành:** 2026-10-05  
**Quản lý phát hành:** PM Agent & Technical Board  
**Tình trạng:** CONDITIONAL GO Resolved $\to$ **FULL GO FOR SPRINT 1**  

---

## 1. Tổng quan Bản phát hành v1.4 (Release Summary)
Bản phát hành **v1.4** là kết quả thực thi toàn diện các **Mandatory Action Items (Hạng mục bắt buộc P0 & P1)** từ báo cáo thẩm định kiến trúc [design_evaluation_report.md](./design_evaluation_report.md). Bản nâng cấp này đóng kín các lỗ hổng bảo mật, triệt tiêu nguy cơ Race Condition, Late Webhook, tấn công Double-Spending, gian lận sổ quỹ tiền mặt và hành vi găm phòng đầu cơ trước khi bắt đầu giai đoạn lập trình.

---

## 2. Chi tiết Các Hạng mục Nâng cấp theo Phân hệ

### 2.1. Phân hệ Yêu cầu Nghiệp vụ (01-requirements)
*   **Đổi tên & Nâng cấp [brd_v1.4.md](file:///home/nam/smart-booking-project/smart-booking-project/01-requirements/brd_v1.4.md):**
    *   *TTL Khóa phòng Online:* Nâng từ 5 phút lên **10 phút (600 giây)** để giải quyết vấn đề nghẽn mạng SMS/Smart OTP ngân hàng.
    *   *Chính sách Hủy phòng Đa tầng (Multi-tiered Cancellation):*
        *   Hủy $\ge 24$ giờ: Hoàn 100%.
        *   Hủy từ 2 giờ đến < 24 giờ: Phạt 20% phí giữ phòng (hoàn 80%).
        *   Hủy < 2 giờ: Phạt 100% (hoàn 0% - `CANCELLED_NO_REFUND`).
        *   Giới hạn chống lạm dụng: Tối đa 2 lần hủy miễn phí/tháng, lần thứ 3 trở đi phạt 30%.
    *   *Quy tắc Kiểm soát 2 Người (Two-Man Rule):* Hoàn tiền mặt tại quầy bắt buộc có mã OTP phê duyệt từ Quản lý ca trực (Shift Supervisor).
    *   *Hạn mức Tín dụng Công nợ (Credit Limit):* Ràng buộc $current\_debt + price \le credit\_limit$.
    *   *Sơ đồ BPMN Mermaid:* Cập nhật Timer 10 phút, nhánh Auto-Refund cho Late Webhook, Two-Man Rule và Hủy 3 tầng.
*   **Cập nhật [user_stories.md](file:///home/nam/smart-booking-project/smart-booking-project/01-requirements/user_stories.md):**
    *   Cập nhật US-03 (10 min TTL), US-04 (Chống double-spending ví), US-05 (Hủy đa tầng & giới hạn tháng), US-07 (Công nợ kèm credit limit), US-08 (Two-Man Rule duyệt OTP hoàn tiền mặt).
*   **Cập nhật [acceptance_criteria/payment_flows.md](file:///home/nam/smart-booking-project/smart-booking-project/01-requirements/acceptance_criteria/payment_flows.md):**
    *   Đồng bộ ma trận trạng thái đặt phòng v1.4, bổ sung trạng thái `EXPIRED_REFUNDED` và mã lỗi HTTP 422 `CREDIT_LIMIT_EXCEEDED`.

---

### 2.2. Phân hệ Thiết kế & Kiến trúc Kỹ thuật (02-architecture)
*   **Nâng cấp [system_design.md](file:///home/nam/smart-booking-project/smart-booking-project/02-architecture/system_design.md):**
    *   *Saga Orchestration for Late Webhook:* Thiết lập cơ chế tự động hoàn tiền (Compensating Transaction qua `RefundWorker`) khi Webhook VNPAY/MoMo gửi về trễ sau 10 phút mà phòng đã bị người khác đặt.
    *   *Transactional Outbox Pattern:* Tích hợp bảng `OUTBOX_EVENTS` và Polling Relay Worker để cam kết không thất lạc email/mã QR khi ứng dụng crash.
    *   *Anti Double-Spending Ví thành viên:* Áp dụng Pessimistic Locking (`SELECT ... FOR UPDATE`), ràng buộc `CHECK (balance >= 0)`.
    *   *Redis Redlock Safe Release:* Giải phóng khóa an toàn bằng Lua Script.
*   **Nâng cấp [database_erd.md](file:///home/nam/smart-booking-project/smart-booking-project/02-architecture/database_erd.md):**
    *   Thêm bảng mới `OUTBOX_EVENTS` (`aggregate_type`, `event_type`, `payload`, `status`).
    *   Bảng `COMPANIES` & `USERS`: Bổ sung `credit_limit` và `current_debt`.
    *   Bảng `BOOKINGS`: Bổ sung `supervisor_otp_approved_by` (Two-Man Rule) và TTL 10 phút.
    *   Bảng `MEMBER_WALLETS`: Bổ sung ràng buộc toàn vẹn `CONSTRAINT chk_wallet_non_negative CHECK (balance >= 0)`.
    *   Bảng `CASH_BOOK_LOGS`: Bổ sung trường `approved_by_supervisor_id`.
*   **Nâng cấp [api_contracts/booking_api.yaml](file:///home/nam/smart-booking-project/smart-booking-project/02-architecture/api_contracts/booking_api.yaml):**
    *   Bắt buộc header `Idempotency-Key` (UUID) trong request `POST /api/v1/bookings`.
    *   Bổ sung mã lỗi HTTP 400 (`MISSING_IDEMPOTENCY_KEY`).
    *   Bổ sung mã lỗi HTTP 422 (`CREDIT_LIMIT_EXCEEDED`).
    *   Cập nhật TTL 10 phút cho mẫu phản hồi Online Payment.

---

### 2.3. Phân hệ Kiểm thử Tự động hóa BDD (04-testing)
*   **Tạo mới [bdd_features/wallet_double_spending.feature](file:///home/nam/smart-booking-project/smart-booking-project/04-testing/bdd_features/wallet_double_spending.feature):**
    *   Kịch bản tấn công gửi 2 request song song trong 5ms kiểm tra tính đúng đắn của Pessimistic Locking và mã lỗi 402.
    *   Kịch bản kiểm tra khả năng deduplication của header `Idempotency-Key` khi người dùng bấm đúp.
*   **Tạo mới [bdd_features/late_webhook_refund.feature](file:///home/nam/smart-booking-project/smart-booking-project/04-testing/bdd_features/late_webhook_refund.feature):**
    *   Kịch bản nhận Webhook sau 10 phút 20 giây khi phòng đã bị khách khác chiếm chỗ, kiểm tra việc tự động gọi API hoàn tiền 100% và bảo toàn phòng cho khách đến sau.
*   **Cập nhật [bdd_features/cancellation.feature](file:///home/nam/smart-booking-project/smart-booking-project/04-testing/bdd_features/cancellation.feature):**
    *   Kiểm thử đầy đủ 4 trường hợp: Hủy $\ge 24$h (hoàn 100%), Hủy 2h - 24h (hoàn 80%), Hủy < 2h (hoàn 0%), và Hủy lần thứ 3 trong tháng (phạt 30%).

---

### 2.4. Phân hệ Quản trị Dự án (03-project-management)
*   **Cập nhật [project_context.yaml](file:///home/nam/smart-booking-project/smart-booking-project/03-project-management/project_context.yaml):**
    *   Nâng phiên bản lên `1.4`.
    *   Chuyển trạng thái toàn bộ 7 rủi ro kiến trúc trọng yếu sang **MITIGATED**.
*   **Lập [changelog_v1.4.md](file:///home/nam/smart-booking-project/smart-booking-project/03-project-management/changelog_v1.4.md):**
    *   Lưu trữ lịch sử cập nhật chi tiết của đợt Post-Audit Hardening.

---

## 3. Danh Mục Các File Đã Thay Đổi Trong Phiên Bản v1.4

| Thư mục | Tên file | Trạng thái | Nội dung chính |
|---|---|:---:|---|
| `01-requirements` | [brd_v1.4.md](file:///home/nam/smart-booking-project/smart-booking-project/01-requirements/brd_v1.4.md) | **Renamed / Created** | Thay thế v1.3; bổ sung TTL 10 phút, Two-Man Rule, Credit Limit, Hủy đa tầng |
| `01-requirements` | [user_stories.md](file:///home/nam/smart-booking-project/smart-booking-project/01-requirements/user_stories.md) | **Updated** | Cập nhật US-03, US-04, US-05, US-07, US-08 |
| `01-requirements` | [acceptance_criteria/payment_flows.md](file:///home/nam/smart-booking-project/smart-booking-project/01-requirements/acceptance_criteria/payment_flows.md) | **Updated** | Ma trận chuyển trạng thái v1.4 |
| `02-architecture` | [system_design.md](file:///home/nam/smart-booking-project/smart-booking-project/02-architecture/system_design.md) | **Updated** | Saga Auto-Refund, Outbox Pattern, TTL 10 phút, Pessimistic Lock |
| `02-architecture` | [database_erd.md](file:///home/nam/smart-booking-project/smart-booking-project/02-architecture/database_erd.md) | **Updated** | Thêm bảng OUTBOX_EVENTS, credit_limit, current_debt, chk_wallet_non_negative |
| `02-architecture` | [api_contracts/booking_api.yaml](file:///home/nam/smart-booking-project/smart-booking-project/02-architecture/api_contracts/booking_api.yaml) | **Updated** | Bắt buộc Idempotency-Key, thêm lỗi 422 CREDIT_LIMIT_EXCEEDED |
| `04-testing` | [bdd_features/wallet_double_spending.feature](file:///home/nam/smart-booking-project/smart-booking-project/04-testing/bdd_features/wallet_double_spending.feature) | **Created** | BDD kịch bản Race condition tiêu âm ví & bấm đúp |
| `04-testing` | [bdd_features/late_webhook_refund.feature](file:///home/nam/smart-booking-project/smart-booking-project/04-testing/bdd_features/late_webhook_refund.feature) | **Created** | BDD kịch bản Saga Auto-Refund cho Late Webhook |
| `04-testing` | [bdd_features/cancellation.feature](file:///home/nam/smart-booking-project/smart-booking-project/04-testing/bdd_features/cancellation.feature) | **Updated** | BDD kịch bản hủy phân tầng 24h, 2h-24h, <2h, giới hạn tháng |
| `03-project-management` | [project_context.yaml](file:///home/nam/smart-booking-project/smart-booking-project/03-project-management/project_context.yaml) | **Updated** | Nâng version 1.4, chuyển trạng thái R01-R07 thành MITIGATED |
| `03-project-management` | [changelog_v1.4.md](file:///home/nam/smart-booking-project/smart-booking-project/03-project-management/changelog_v1.4.md) | **Created** | Tài liệu tổng kết phát hành v1.4 |
| `(root)` | [project_context.yaml](file:///home/nam/smart-booking-project/smart-booking-project/project_context.yaml) | **Updated** | Đồng bộ cấu hình ngữ cảnh root |
