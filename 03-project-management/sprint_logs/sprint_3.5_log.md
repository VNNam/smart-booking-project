# Sprint 3.5 Log: Frontend Application Development (Mobile App & Web Admin UI)

**Project:** Smart Meeting Room Booking System  
**BRD Version Alignment:** v1.4 (Post-Audit Hardened)  
**Quản lý bởi:** @PM_Agent  
**Thời gian thực hiện:** 2026-10-07 đến 2026-10-16  
**Trạng thái:** **COMPLETED (100% - 34/34 SP Hoàn Thành)**  

---

## 1. Bối Cảnh & Mục Tiêu Sprint (Sprint Goal)
Sau quá trình rà soát chéo giữa các đặc vụ (@PM_Agent, @BA_Agent, @Architect_Agent), hệ thống đã phát hiện một khoảng trống nghiêm trọng: Backend APIs và hạ tầng cơ sở dữ liệu đã hoàn tất nhưng các ứng dụng phía khách hàng (**Mobile App** cho Khách vãng lai/Thành viên và **Web Admin** cho Quản lý/Lễ tân) chưa được tích hợp đầy đủ vào lộ trình thực thi trước khi chuyển sang UAT.

**Quyết định điều phối:**
* **Tạm hoãn giai đoạn UAT (Stage 4)** để chèn một Sprint chuyên trách: **Sprint 3.5 (Frontend Application Development)**.
* Xây dựng đầy đủ các màn hình giao diện người dùng theo đặc tả [frontend_scope.md](../../01-requirements/frontend_scope.md) và khung kiến trúc [frontend_architecture.md](../../02-architecture/frontend_architecture.md).
* Bảo đảm toàn bộ các cơ chế phòng vệ kiến trúc đã chốt ở BRD v1.4 (Đồng hồ đếm ngược giữ chỗ 10 phút, kiểm tra số dư ví an toàn, kiểm soát hạn mức công nợ doanh nghiệp, xử lý thông báo Late Webhook Auto-Refund và Idempotency Interceptor) được hiện thực hóa trực quan trên giao diện người dùng.

---

## 2. Danh Sách Công Việc Cam Kết (Sprint Backlog & Execution)

| Mã Task | Phân Hệ | Tên Công Việc & Chi Tiết Triển Khai | Assignee | Target File | Ước Lượng (SP) | Trạng Thái |
|---|---|---|---|---|:---:|:---:|
| **Task 3.5.1** | Web Admin | Xây dựng Bảng lịch đặt phòng tổng thể (**Master Calendar Grid View**) theo thời gian thực (xanh/cam/xanh dương/tím) và Module quản lý công nợ doanh nghiệp (**Corporate Postpaid Debt UI**) kèm kiểm tra hạn mức tín dụng (`credit_limit`). | @Dev_Agent | [CalendarGrid.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/admin/components/CalendarGrid.tsx)<br>[corporate-debts.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/admin/pages/corporate-debts.tsx) | 8 SP | **DONE** |
| **Task 3.5.2** | Mobile App | Xây dựng màn hình Tra cứu phòng theo thời gian thực (**Room Search Screen**) với bộ lọc tiện ích (sức chứa, máy chiếu, VC) và màn hình Chi tiết phòng kèm lựa chọn Slot giờ họp (**Room Detail Screen**). | @Dev_Agent | [RoomSearchScreen.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/mobile/src/screens/RoomSearchScreen.tsx)<br>[RoomDetailScreen.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/mobile/src/screens/RoomDetailScreen.tsx) | 8 SP | **DONE** |
| **Task 3.5.3** | Mobile App | Xây dựng màn hình Thanh toán đa phương thức (**Checkout Screen**) tích hợp Widget **Đồng hồ đếm ngược giữ chỗ 10 phút (600s)** bù trừ lệch giờ client, kiểm tra số dư ví thành viên, Deep Link mở Sandbox VNPAY/MoMo và xử lý thông báo Late Webhook Auto-Refund. | @Dev_Agent | [CheckoutScreen.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/mobile/src/screens/CheckoutScreen.tsx)<br>[CountdownTimer.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/mobile/src/components/CountdownTimer.tsx) | 8 SP | **DONE** |
| **Task 3.5.4** | Mobile App | Xây dựng màn hình Lịch sử đặt phòng & Thẻ mã **QR Check-in** bảo mật động, kết hợp màn hình Hủy phòng phân tầng (**Tiered Cancellation UI**) hiển thị trực quan tỷ lệ phạt (100% / 80% / 0%) và bộ đếm giới hạn 2 lần hủy miễn phạt/tháng. | @Dev_Agent | [BookingHistoryScreen.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/mobile/src/screens/BookingHistoryScreen.tsx)<br>[CancelBookingScreen.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/mobile/src/screens/CancelBookingScreen.tsx) | 5 SP | **DONE** |
| **Task 3.5.5** | Frontend QA | Xây dựng bộ kiểm thử tích hợp giao diện người dùng tự động: Kiểm chứng hết hạn đồng hồ đếm ngược 10p, chặn thanh toán khi thiếu số dư ví, chặn tạo đơn công nợ khi vượt hạn mức tín dụng, và kiểm tra tính duy nhất của header `Idempotency-Key` (UUIDv4). | @QA_Agent | [frontend_integration.test.ts](file:///home/nam/smart-booking-project/smart-booking-project/test/frontend/frontend_integration.test.ts) | 5 SP | **DONE** |

**Tổng Story Points Sprint 3.5:** 34 SP (Đã hoàn thành 34/34 SP - 100%)


---

## 3. Các Ràng Buộc & Trường Hợp Biên Cần Xử Lý Chặt Chẽ Trên UI

1. **Đồng hồ đếm ngược 10 phút (Lock TTL Countdown):**
   * Phải tính toán độ lệch đồng hồ giữa thiết bị client và máy chủ (`server_time` vs `client_now`) để tránh tình trạng client vẫn còn 30s nhưng server đã hủy Redis key.
   * Khi bộ đếm về `00:00`, tự động vô hiệu hóa nút thanh toán, dừng polling và thông báo phòng đã được giải phóng.
2. **Xử lý Thông báo Late Webhook Auto-Refund:**
   * Không hiển thị lỗi mơ hồ. Bắt buộc hiển thị rõ dialog thông báo: *"Thời gian giữ chỗ đã hết, hệ thống đã tự động hoàn tiền 100% về tài khoản của bạn qua Saga Auto-Refund."*
3. **Phân tầng Hủy phòng & Giới hạn Tháng:**
   * Giao diện hủy phòng phải hiển thị bảng phân tích tiền hoàn cụ thể trước khi người dùng bấm xác nhận.
   * Nếu người dùng đã hủy $\ge 2$ lần trong tháng, hiển thị badge cảnh báo màu cam về mức phạt phụ trội 30%.
4. **Hạn mức Công nợ Doanh nghiệp (Credit Limit):**
   * Nếu `current_debt + room_price > credit_limit`, nút "Xác Nhận Đặt Phòng Công Nợ" trên Web Admin phải bị khóa xám, đồng thời hiển thị số tiền vượt trần và mã lỗi 422 `CREDIT_LIMIT_EXCEEDED`.
5. **Idempotency Interceptor:**
   * Mọi thao tác submit thanh toán, tạo đơn hoặc hủy đơn đều phải tự động sinh `Idempotency-Key` UUIDv4 ở tầng HTTP Interceptor, bảo đảm an toàn khi người dùng bấm đúp hoặc mạng gián đoạn thử lại.

---

## 4. Kế Hoạch Triển Khai Tiếp Theo
* `@Dev_Agent` sẽ tiếp nhận và lần lượt hiện thực hóa các Task từ `Task 3.5.1` đến `Task 3.5.4`.
* `@QA_Agent` tiến hành viết kịch bản kiểm thử tích hợp giao diện (`Task 3.5.5`).
* Sau khi Sprint 3.5 hoàn tất 100%, `@PM_Agent` sẽ mở lại cổng phê duyệt để tiến hành Giai đoạn 4 (UAT & Load Testing).
