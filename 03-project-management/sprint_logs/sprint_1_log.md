# Sprint 1 Log: Core Booking Engine & Slot Locking

- **Thời gian:** 2026-10-15 đến 2026-10-29 (2 tuần)
- **Mục tiêu Sprint (Sprint Goal):** Xây dựng thành công hệ thống xác thực người dùng và Core Booking Engine có khả năng kiểm soát concurrency, khóa slot bằng Redis Redlock tránh race condition.
- **Trạng thái:** Planned (Chuẩn bị bắt đầu)

---

## 1. Backlog Sprint 1 (Committed Stories)
| Story ID | Tên công việc | Assignee | Estimate (SP) | Trạng thái |
|---|---|---|---|---|
| **US-01** | Đăng ký & Đăng nhập OTP / JWT Auth | Dev Agent 1 | 5 SP | To Do |
| **US-02** | Tra cứu danh sách Slot trống theo thời gian thực | Dev Agent 2 | 8 SP | To Do |
| **US-03.A** | Cơ chế Redis Redlock giữ chỗ 10 phút | Tech Lead / Dev 1 | 8 SP | To Do |
| **US-03.B** | Database schema migration & seed dữ liệu mẫu | Dev Agent 2 | 5 SP | To Do |

**Tổng Story Points:** 26 SP

---

## 2. Nhật ký Tiến độ (Daily Standup Highlights)
- *Day 01:* Khởi động Sprint 1, phân bổ task và chuẩn bị môi trường Docker local (PostgreSQL + Redis).
- *Day 05:* (Sẽ được cập nhật tự động bởi PM Agent).

---

## 3. Rủi ro & Khó khăn (Risks & Impediments)
- Cần đảm bảo cụm Redis Cluster hoặc Sentinel hoạt động ổn định để tránh mất lock phân tán khi có sự cố mạng.

---

## 4. Retrospective (Tổng kết cuối Sprint)
*(Sẽ được đánh giá sau ngày 2026-10-29)*
