# Đặc Tả Phạm Vi Phát Triển Giao Diện Người Dùng (Frontend Scope & UI Components)

**Dự án:** Smart Meeting Room Booking System  
**Phiên bản BRD:** v1.4 (Post-Audit Hardened)  
**Phân tích bởi:** @BA_Agent  
**Trạng thái:** Approved Specification  
**Ngày phê duyệt:** 2026-10-06  

---

## 1. Bối Cảnh & Mục Tiêu Nghiệp Vụ

Dựa trên kết quả rà soát yêu cầu nghiệp vụ theo [brd_v1.4.md](./brd_v1.4.md) (Mục 4 - Đối tượng người dùng và Mục 6 - Sơ đồ luồng BPMN), hệ thống bắt buộc phải cung cấp hai phân hệ giao diện người dùng trực quan, bảo mật và đồng bộ thời gian thực với Backend Core APIs:

1. **Phân hệ Mobile App (iOS / Android):** Dành riêng cho Khách vãng lai (End-User) và Thành viên trả trước (Pre-paid Member) để tra cứu phòng, giữ chỗ trực tuyến (TTL 10 phút), thanh toán qua Cổng VNPAY/MoMo hoặc Ví thành viên, xem mã QR check-in và tự hủy lịch có kiểm soát phí phạt đa tầng.
2. **Phân hệ Web Admin Dashboard:** Dành cho Lễ tân, Quản lý ca trực (Shift Supervisor) và Kế toán để theo dõi lịch phòng tổng thể (Grid View), thực hiện thu tiền mặt tại quầy (Walk-in Cash), quản lý hạn mức công nợ doanh nghiệp (Postpaid Debt) và phê duyệt hoàn tiền mặt 2 bước (Two-Man Rule OTP).

---

## 2. Chi Tiết Màn Hình Phân Hệ Mobile App (End-User & Member)

### 2.1. Màn hình 1: Tra cứu & Bộ lọc Phòng họp (Room Search & Real-Time Filter)
* **Mục tiêu:** Cho phép người dùng tìm phòng theo thời gian thực với phản hồi trực quan dưới 1 giây.
* **Các thành phần UI:**
  * **Thanh chọn thời gian & Chi nhánh:** Date picker (hôm nay, ngày mai, chọn ngày), Time Range Slider (bước nhảy 30 phút).
  * **Bộ lọc tiện ích (Amenities Filter):** Sức chứa (4, 8, 12, 20+ người), Máy chiếu (Projector), Bảng trắng (Whiteboard), Thiết bị họp trực tuyến (Video Conference).
  * **Danh sách thẻ phòng (Room Cards):**
    * Tên phòng, loại phòng (`STANDARD`, `EXECUTIVE`, `BOARDROOM`), ảnh minh họa, giá theo giờ (VND/h).
    * **Huy hiệu trạng thái phòng (Status Badges):**
      * Xanh lá: `Còn trống (AVAILABLE)` - Cho phép bấm đặt.
      * Vàng cam nhấp nháy: `Đang giữ chỗ trực tuyến (LOCKED_PENDING_ONLINE)` - Kèm thời gian chờ.
      * Xám mờ: `Đã được đặt (BOOKED)` - Vô hiệu hóa nút đặt.

### 2.2. Màn hình 2: Chi tiết Phòng & Lựa chọn Khung giờ (Booking Details & Slot Selection)
* **Mục tiêu:** Hiển thị chi tiết phòng, khung giờ khả dụng và bảng dự tính chi phí.
* **Các thành phần UI:**
  * Carousel hình ảnh phòng họp thực tế & sơ đồ bố trí chỗ ngồi.
  * Lưới chọn Slot giờ (Interactive Time Slots): Đánh dấu trực quan các khung giờ khả dụng.
  * Tóm tắt thời lượng họp & tạm tính số tiền thanh toán ($duration \times hourly\_rate$).
  * Banner thông báo chính sách hủy phòng phân tầng v1.4 (giúp khách nắm rõ trước khi thanh toán).

### 2.3. Màn hình 3: Thanh toán Đa phương thức & Đồng hồ Đếm ngược (Checkout & Payment Gateway)
* **Mục tiêu:** Xử lý thanh toán an toàn, minh bạch, loại bỏ race-condition.
* **Các thành phần UI:**
  * **Đồng hồ đếm ngược giữ chỗ 10 phút (Lock TTL Countdown Timer):**
    * Widget đếm ngược từ 10:00 xuống 00:00 (đồng bộ chính xác theo `lock_expires_at` từ Redis).
    * Cảnh báo đổi màu: Vàng khi còn > 2 phút; Đỏ và rung cảnh báo khi còn < 2 phút.
    * Khi hết hạn: Tự động hiển thị popup thông báo phòng đã được giải phóng và chuyển về màn hình tìm kiếm.
  * **Lựa chọn phương thức thanh toán:**
    * **Ví Thành viên (Prepaid Member Wallet):** Hiển thị số dư hiện tại (`balance`). Nếu `balance < price`, hiển thị nút *"Nạp thêm tiền vào ví"*; nếu đủ số dư, hiển thị nút *"Xác nhận trừ ví tức thì"*.
    * **Cổng thanh toán Trực tuyến (Online Gateway):** Chọn VNPAY, MoMo hoặc ZaloPay. Nút bấm *"Thanh toán an toàn qua VNPAY"* tự động mở App ngân hàng qua Deep Link hoặc WebView bảo mật.
  * **Xử lý thông báo Late Webhook:** Nếu người dùng thanh toán thành công nhưng hệ thống báo phòng đã mất do quá hạn 10 phút, màn hình hiển thị banner thân thiện: *"Giao dịch của bạn đã được tiếp nhận. Do thời gian giữ chỗ đã hết, hệ thống đã tự động hoàn tiền 100% về tài khoản của bạn (Saga Auto-Refund)."*

### 2.4. Màn hình 4: Lịch sử & Thẻ Phòng Xác nhận (Booking History & QR Check-in)
* **Mục tiêu:** Quản lý danh sách đặt phòng và cung cấp mã QR check-in vào phòng.
* **Các thành phần UI:**
  * Tabs phân loại: `Sắp tới (Upcoming)`, `Đã hoàn thành (Past)`, `Đã hủy (Cancelled)`.
  * **Thẻ Check-in Điện tử:**
    * Mã QR bảo mật động (chống chụp màn hình gian lận) phục vụ lễ tân quét mã vào phòng.
    * Thông tin phòng, giờ bắt đầu/kết thúc, mật khẩu Wi-Fi nội bộ.

### 2.5. Màn hình 5: Hủy phòng & Dự tính Hoàn tiền Phân tầng (Cancellation & Refund UI)
* **Mục tiêu:** Minh bạch hóa chính sách hủy theo BRD v1.4.
* **Các thành phần UI:**
  * Widget phân tích thời gian: Tính toán khoảng cách thời gian từ hiện tại đến cuộc họp.
  * Bảng phân tích tài chính hủy đơn:
    * Mốc $\ge 24\text{h}$: Hoàn 100% tiền.
    * Mốc $2\text{h} - 24\text{h}$: Hoàn 80%, thu phí phạt 20%.
    * Mốc $< 2\text{h}$: Phạt 100%, hoàn 0 VND (Hiển thị cảnh báo nghiêm trọng).
  * Bộ đếm giới hạn tháng: *"Bạn đã sử dụng [X]/2 lần hủy miễn phạt trong tháng này."* (Nếu $X \ge 2$, hiển thị mức phạt bổ sung 30%).
  * Nút bấm xác nhận hủy phòng kèm dialog cảnh báo xác nhận 2 lần.

---

## 3. Chi Tiết Màn Hình Phân Hệ Web Admin Dashboard

### 3.1. Màn hình 1: Lịch Đặt Phòng Tổng Thể (Master Booking Calendar / Grid View)
* **Mục tiêu:** Cung cấp góc nhìn toàn cảnh lịch họp của toàn bộ phòng theo thời gian thực cho Quản lý & Lễ tân.
* **Các thành phần UI:**
  * **Grid Timeline (Trục hoành: Khung giờ 08:00 - 22:00, Trục tung: Danh sách các phòng):**
    * Thẻ lịch màu sắc trực quan:
      * 🟢 Xanh lục: `Còn trống (AVAILABLE)`
      * 🟠 Cam: `Đang giữ chỗ online (LOCKED - đếm ngược 10p)`
      * 🔵 Xanh dương: `Đã xác nhận thanh toán (CONFIRMED_PAID / CONFIRMED)`
      * 🟣 Tím: `Công nợ doanh nghiệp (CONFIRMED_DEBT)`
      * ⚫ Xám: `Bảo trì / Đã qua (MAINTENANCE / PAST)`
  * Chế độ xem linh hoạt: Theo Ngày (Day View), Theo Tuần (Week View), Theo Phòng (Room View).
  * Quick-Action Popover: Nhấp vào slot trống để tạo đơn tại quầy ngay lập tức; nhấp vào slot đã đặt để xem thông tin khách hoặc mở modal hủy.

### 3.2. Màn hình 2: Đặt Phòng & Thu Tiền Mặt Tại Quầy (Walk-in Cash Booking)
* **Trạng thái phát triển:** Đã hoàn thiện mã nguồn tại [frontend/admin/pages/cash-booking.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/admin/pages/cash-booking.tsx).
* **Các thành phần UI:**
  * Form chọn phòng, ngày và khung giờ trực tiếp tại quầy lễ tân.
  * Nhập thông tin khách vãng lai: Họ tên, Số điện thoại, Ghi chú cuộc họp.
  * Tự sinh `Idempotency-Key` UUIDv4 gửi kèm request ngăn chặn thu trùng.
  * Xác nhận thu tiền mặt và hiển thị hóa đơn biên nhận tự động sinh mã `CASH_IN_COLLECT` trong sổ quỹ ca trực.

### 3.3. Màn hình 3: Quản Lý Công Nợ Doanh Nghiệp (Corporate Postpaid Debt Management)
* **Mục tiêu:** Kiểm soát chặt chẽ hạn mức tín dụng công nợ theo BRD v1.4.
* **Các thành phần UI:**
  * Danh sách tài khoản doanh nghiệp: Tên công ty, Mã tài khoản (`corporate_debt_account`), Hạn mức cấp (`credit_limit`), Dư nợ hiện tại (`current_debt`), Hạn mức khả dụng còn lại.
  * Thanh tiến trình công nợ trực quan (Credit Usage Progress Bar) đổi màu đỏ khi vượt quá 80% hạn mức.
  * Form tạo đơn phòng công nợ:
    * Tự động kiểm tra: Nếu `current_debt + room_price > credit_limit`, nút xác nhận bị vô hiệu hóa kèm cảnh báo đỏ `CREDIT_LIMIT_EXCEEDED`.
  * Nhật ký đối soát công nợ và nút xuất báo cáo hóa đơn kỳ hạn (Billing Statement).

### 3.4. Màn hình 4: Modal Hủy Phòng & Duyệt OTP Quản Lý Ca Trực (Two-Man Rule Refund Modal)
* **Trạng thái phát triển:** Đã hoàn thiện mã nguồn tại [frontend/admin/components/RefundModal.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/admin/components/RefundModal.tsx).
* **Các thành phần UI:**
  * Phân tích tự động chính sách hủy phân tầng (100% / 80% / 0%).
  * Khu vực **Two-Man Rule** khi hoàn tiền mặt:
    * Khóa không cho Lễ tân đơn phương hoàn tiền.
    * Nút *"Gửi OTP Quản Lý"* kích hoạt gửi OTP tới Quản lý ca trực (Shift Supervisor).
    * Trường nhập mã OTP 6 số bảo mật.
    * Xác thực đúng OTP mới sinh phiếu chi `CASH_OUT_REFUND` và in phiếu chi đối soát.

### 3.5. Màn hình 5: Sổ Quỹ Tiền Mặt & Bàn Giao Ca Trực (Cash Book Logs & Shift Handover)
* **Mục tiêu:** Minh bạch dòng tiền mặt, phục vụ kế toán và đối soát ca trực.
* **Các thành phần UI:**
  * Bảng nhật ký thu/chi tiền mặt theo thời gian thực: Mã phiếu thu (`CASH_IN_COLLECT`), Mã phiếu chi hoàn (`CASH_OUT_REFUND`), ID Lễ tân, ID Quản lý duyệt OTP.
  * Tổng kết quỹ ca: Đầu ca, Thu trong ca, Chi hoàn trong ca, Tồn quỹ thực tế cuối ca.
  * Nút *"Chốt ca & In biên bản bàn giao quỹ"*.

---

## 4. Ma Trận Ánh Xạ Nghiệp Vụ - Màn Hình (Traceability Matrix)

| Quy tắc nghiệp vụ BRD v1.4 | Giao diện Mobile App | Giao diện Web Admin | Trạng thái kỹ thuật |
|:---|:---|:---|:---:|
| **Lock giữ chỗ 10 phút (TTL 600s)** | Màn hình 1, 2, 3 (Widget đếm ngược 10p) | Màn hình 1 (Thẻ slot màu cam nhấp nháy đếm ngược) | Đã sẵn sàng Backend Redis Redlock |
| **Thanh toán Ví thành viên (Chống double-spending)** | Màn hình 3 (Kiểm tra số dư, trừ ví tức thì) | Xem lịch sử giao dịch thành viên | Đã sẵn sàng Backend Pessimistic Lock |
| **Saga Auto-Refund khi Webhook trễ** | Màn hình 3, 4 (Banner thông báo hoàn tiền tự động) | Màn hình 1, 5 (Cập nhật đơn EXPIRED_REFUNDED) | Đã sẵn sàng PaymentWebhookService |
| **Chính sách hủy đa tầng (100% / 80% / 0%)** | Màn hình 5 (Preview tiền hoàn & phí phạt) | Màn hình 4 ([RefundModal.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/admin/components/RefundModal.tsx)) | Đã sẵn sàng BookingService.cancelBooking |
| **Quy tắc kiểm soát 2 người (Two-Man Rule OTP)** | Không hiển thị (Không áp dụng cho Mobile) | Màn hình 4 ([RefundModal.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/admin/components/RefundModal.tsx)), Màn hình 5 | Đã hoàn thiện Component & Backend DDL |
| **Hạn mức công nợ doanh nghiệp (Credit Limit)** | Không hiển thị | Màn hình 3 (Credit Limit Manager) | Đã sẵn sàng DB schema & API 422 error |
| **Thu tiền mặt tại quầy & Idempotency** | Không hiển thị (Chặn 403 Forbidden) | Màn hình 2 ([cash-booking.tsx](file:///home/nam/smart-booking-project/smart-booking-project/frontend/admin/pages/cash-booking.tsx)) | Đã hoàn thiện trang Web Admin |
