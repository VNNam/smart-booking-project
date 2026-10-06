# Sprint 2 Log: Multi-Payment Ecosystem, Web Admin Walk-in & Cancellation
**Project:** Smart Meeting Room Booking System  
**BRD Version Alignment:** v1.3  

- **Thời gian:** 2026-10-30 đến 2026-11-16 (2.5 tuần)
- **Mục tiêu Sprint (Sprint Goal):** Triển khai toàn diện hạ tầng thanh toán đa phương thức theo BRD v1.3: Backend APIs (Online Gateway, Ví thành viên, Tiền mặt tại quầy, Công nợ), Frontend Web Admin UI cho lễ tân tạo booking thu tiền mặt tại quầy và ghi nhận sổ quỹ.
- **Trạng thái:** Backlog / Planning (Updated for BRD v1.3)

---

## 1. Danh sách Công việc Cần làm (Sprint Backlog - To Do)

| Mã Task | Phân hệ | Tên công việc & Đặc tả chi tiết | Story ID | Assignee | Estimate (SP) | Trạng thái |
|---|---|---|---|---|---|---|
| **BE-01** | Backend | Hiện thực hóa API `POST /api/v1/bookings` theo contract `booking_api.yaml` (Phân quyền Role, bắt lỗi 402, 403, 409) | US-03, US-06 | Dev Agent 1 | 8 SP | To Do |
| **BE-02** | Backend | Core Engine Ví thành viên: Kiểm tra số dư atomic, trừ tiền tức thì và ghi log `WALLET_TRANSACTIONS` | US-04 | Dev Agent 2 | 5 SP | To Do |
| **BE-03** | Backend | Tích hợp cổng thanh toán trực tuyến (VNPAY/MoMo/ZaloPay IPN) + Redis TTL 300s khóa phòng | US-03 | Dev Agent 1 | 8 SP | To Do |
| **BE-04** | Backend | Module Quản lý Sổ quỹ `CASH_BOOK_LOGS` và API ghi nhận phiếu thu/chi hoàn tiền mặt khi Admin hủy đơn | US-06, US-08 | Dev Agent 2 | 5 SP | To Do |
| **FE-01** | Frontend Web Admin | Xây dựng giao diện đặt phòng tại quầy cho Lễ tân (Walk-in Cash Booking UI): Chọn phòng, thu tiền mặt, in biên nhận | US-06 | Frontend Dev | 8 SP | To Do |
| **FE-02** | Frontend Web Admin | Xây dựng UI đặt phòng thanh toán sau / Công nợ (Postpaid Debt) cho khách VIP & nội bộ | US-07 | Frontend Dev | 5 SP | To Do |
| **FE-03** | Frontend Web Admin | Modal xử lý hủy phòng tại quầy với tùy chọn checkbox "Hủy & Hoàn tiền mặt" cập nhật sổ quỹ | US-08 | Frontend Dev | 3 SP | To Do |
| **QA-01** | Test Automation | Tự động hóa BDD test cases theo `cash_payment.feature`, `wallet_payment.feature` và `online_payment.feature` | All | QA Agent | 5 SP | To Do |

**Tổng Story Points Sprint 2:** 47 SP

---

## 2. Kế hoạch Kiểm thử & UAT (Test & Verification)
1. **Kiểm thử Bảo mật Phân quyền (RBAC):**
   - Đảm bảo token `CUSTOMER` gọi `CASH_ON_ARRIVAL` hoặc `POSTPAID_DEBT` luôn bị từ chối 403 Forbidden.
2. **Kiểm thử Ngoại lệ Ví thành viên:**
   - Số dư ví < giá phòng -> trả về 402 Payment Required mà không giữ lock phòng.
3. **Kiểm thử luồng Tiền mặt & Sổ quỹ:**
   - Mỗi đơn `CONFIRMED_PAID` phải sinh đúng một bản ghi thu tiền trong `CASH_BOOK_LOGS`.
   - Mỗi thao tác Admin hủy kèm hoàn tiền mặt phải sinh đúng một bản ghi chi tiền trong `CASH_BOOK_LOGS`.
4. **Kiểm thử Cổng thanh toán Sandbox (VNPAY/MoMo/ZaloPay):**
   - Timeout 5 phút tự động kích hoạt cron/Redis expiry trả phòng về `AVAILABLE`.
