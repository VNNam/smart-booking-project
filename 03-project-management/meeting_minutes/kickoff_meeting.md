# Meeting Minutes: Dự án Smart Booking - Kickoff Meeting

- **Ngày họp:** 2026-10-05
- **Thời gian:** 14:00 - 15:30 (GMT+7)
- **Thành phần tham dự:** Product Owner, Solution Architect, PM Agent, Lead Developer, QA Lead.
- **Người ghi chép:** PM Agent

---

## 1. Mục tiêu Cuộc họp (Meeting Objective)
- Thống nhất mục tiêu kinh doanh, kiến trúc kỹ thuật và phạm vi triển khai MVP cho dự án **Smart Booking**.
- Chốt cấu trúc repository và phân công vai trò giữa các AI Agents và Developer.

---

## 2. Các Nội dung Thảo luận Chính (Discussion Points)
1. **Phạm vi MVP (Scope):**
   - Tập trung vào tính năng cốt lõi: Khám phá dịch vụ, chọn slot theo thời gian thực, giữ chỗ 10 phút, thanh toán VNPAY/MoMo và hủy lịch theo chính sách.
   - Các tính năng nâng cao (AI gợi ý lịch thông minh, xếp lịch tối ưu tự động) sẽ dời sang Phase 2.
2. **Giải pháp chống trùng lịch (Double Booking Prevention):**
   - Architect Agent trình bày giải pháp 2 lớp: Redis Redlock (bảo vệ ở tầng memory) và Unique Partial Index ở PostgreSQL (bảo vệ ở tầng database). Đội ngũ nhất trí 100%.
3. **Quy chuẩn làm việc:**
   - Mọi User Story bắt buộc phải có Acceptance Criteria rõ ràng và kịch bản BDD Gherkin trước khi Developer Agent bắt đầu viết code.

---

## 3. Hành động Tiếp theo (Action Items)
| STT | Nhiệm vụ | Người phụ trách | Hạn hoàn thành |
|---|---|---|---|
| 1 | Hoàn tất file `project_context.yaml` và cấu trúc repo | PM Agent | 2026-10-05 |
| 2 | Hoàn thiện ERD chi tiết và OpenAPI 3.0 specs | Architect Agent | 2026-10-12 |
| 3 | Soạn thảo kịch bản BDD `.feature` cho thanh toán và hủy lịch | QA Agent | 2026-10-14 |
