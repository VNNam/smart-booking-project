# Issue & Risk Tracker
**Project:** Smart Meeting Room Booking System  
**BRD Version Alignment:** v1.4 (Post-Audit Hardened)  
**Quản lý bởi:** @PM_Agent  
**Cập nhật lần cuối:** 2026-10-06  

Tài liệu theo dõi các vấn đề kỹ thuật, blocker và rủi ro dự án được giám sát bởi **PM Agent**.

---

## 1. Danh sách Vấn đề & Rủi ro (Issues & Risks Tracking)

| Mã | Loại | Tiêu đề / Mô tả | Mức độ | Trạng thái | Người phụ trách | Phương án xử lý & Kết quả (Resolution) |
|---|---|---|---|---|---|---|
| **ISSUE-01** | Risk | Nguy cơ **Race Condition** khi nhiều user cùng ấn đặt 1 phòng hot | Critical | **Resolved** | @Architect_Agent | Áp dụng Redis Distributed Lock (TTL 10 phút) kết hợp PostgreSQL Partial Unique Index `idx_unique_active_meeting_slot` ([schema_v1.sql](file:///home/nam/smart-booking-project/smart-booking-project/src/database/schema_v1.sql)). |
| **ISSUE-02** | Blocker | Tích hợp cổng thanh toán trực tuyến và mô phỏng Sandbox VNPAY | High | **Resolved** | @Dev_Agent | Triển khai xác thực chữ ký HMAC-SHA512 và Saga Auto-Refund trong [PaymentWebhookService.ts](file:///home/nam/smart-booking-project/smart-booking-project/src/services/PaymentWebhookService.ts). |
| **ISSUE-03** | Risk | Nguy cơ thất thoát / gian lận tiền mặt khi Lễ tân thu hoặc hoàn tiền tại quầy | High | **Resolved** | @Dev_Agent | Tự động sinh `CASH_IN_COLLECT` khi tạo đơn ([cash-booking.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/admin/pages/cash-booking.tsx)) và áp dụng **Two-Man Rule** bắt buộc duyệt OTP Quản lý khi hoàn tiền `CASH_OUT_REFUND` ([RefundModal.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/admin/components/RefundModal.tsx)). |
| **ISSUE-04** | Risk | Concurrency trên số dư Ví Thành viên khi đặt nhiều phòng cùng lúc (Double-Spending) | High | **Resolved** | @Dev_Agent | Database Transaction với Pessimistic Lock (`SELECT ... FOR UPDATE`), ràng buộc `CHECK (balance >= 0)` và hàm `deduct_member_wallet()` ([schema_v1.sql](file:///home/nam/smart-booking-project/smart-booking-project/src/database/schema_v1.sql)). |
| **ISSUE-05** | Tech Debt | Kịch bản tự động dọn dẹp các phòng lock quá hạn 10 phút | Medium | **Resolved** | @Dev_Agent | Quét `lock_expires_at < NOW()` và tự động giải phóng Redis Key & DB Slot về `AVAILABLE`. |
| **ISSUE-06** | Risk | Nguy cơ Late Webhook đến trễ sau 10 phút khi phòng đã bị người khác đặt | Critical | **Resolved** | @Architect_Agent | Triển khai Saga Auto-Refund: hoàn tiền 100% qua API cổng và chuyển trạng thái `EXPIRED_REFUNDED` mà không đè booking ([PaymentWebhookService.ts](file:///home/nam/smart-booking-project/smart-booking-project/src/services/PaymentWebhookService.ts)). |
| **ISSUE-07** | Risk | Vượt hạn mức tín dụng công nợ của doanh nghiệp (Corporate Credit Limit) | High | **Resolved** | @Dev_Agent | Kiểm tra `current_debt + price <= credit_limit`, từ chối và trả về HTTP 422 `CREDIT_LIMIT_EXCEEDED` ([BookingService.ts](file:///home/nam/smart-booking-project/smart-booking-project/src/services/BookingService.ts)). |

---

## 2. Tiêu chí Đánh giá Mức độ Nghiêm trọng
- **Critical (Khẩn cấp):** Ảnh hưởng trực tiếp đến tính toàn vẹn dữ liệu (trùng lịch, thất thoát tiền bạc). Đã được kiểm chứng qua các bài test Concurrency & Saga.
- **High (Cao):** Chặn tiến độ của Sprint hoặc tính năng cốt lõi (thanh toán, Two-Man Rule, công nợ). Đã được giải quyết 100%.
- **Medium (Trung bình):** Vấn đề dọn dẹp cache / cron đối soát định kỳ.
- **Low (Thấp):** Giao diện nhỏ, chỉnh sửa text hoặc tối ưu code nhỏ.

