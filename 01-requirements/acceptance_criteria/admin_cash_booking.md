# Acceptance Criteria: Web Admin - Đặt Phòng Tiền Mặt & Hoàn Tiền 2 Bước (Two-Man Rule)

**Feature ID:** US-06 (Walk-in Cash Booking) & US-08 (Two-Man Rule Cash Refund)  
**BRD Version Alignment:** v1.4 (Post-Audit Hardened)  
**Status:** Approved  
**Assignee / Author:** @BA_Agent  
**Referenced Documents:** [brd_v1.4.md](../brd_v1.4.md), [user_stories.md](../user_stories.md)  

---

## 1. Luồng 1: Lễ Tân Đặt Phòng Trực Tiếp Tại Quầy (Walk-in Cash Booking)

### 1.1. AC-CASH-01: Tra cứu và lựa chọn Khung giờ họp
* **Given:** Lễ tân hoặc Quản lý đã đăng nhập vào hệ thống Web Admin với vai trò `STAFF` hoặc `ADMIN`.
* **When:** Truy cập vào trang đặt phòng tại quầy `/cash-booking` và chọn ngày cùng chi nhánh làm việc.
* **Then:** Hệ thống hiển thị trực quan danh sách các phòng họp cùng các khung giờ (`AVAILABLE`, `LOCKED`, `BOOKED`).
* **And:** Lễ tân chỉ được phép bấm chọn các khung giờ có trạng thái `AVAILABLE`. Các khung giờ `LOCKED` (đang giữ chỗ trực tuyến 10 phút) hoặc `BOOKED` bị vô hiệu hóa.

### 1.2. AC-CASH-02: Nhập thông tin khách hàng & Cơ chế phòng vệ Idempotency
* **Given:** Lễ tân đã chọn phòng và khung giờ họp hợp lệ.
* **When:** Lễ tân điền đầy đủ Họ tên, Số điện thoại của khách hàng tại quầy và bấm nút *"✓ Xác Nhận & Đã Thu Tiền Mặt"*.
* **Then:** Hệ thống frontend bắt buộc tự sinh một khóa định danh duy nhất dạng UUIDv4 và đính kèm vào header `Idempotency-Key` của request `POST /api/v1/bookings`.
* **And:** Nếu Lễ tân vô tình bấm đúp nút xác nhận, request thứ hai phải nhận lại kết quả từ Redis cache (24h) mà không tạo bản ghi trùng lặp hoặc nhân đôi số tiền thu.

### 1.3. AC-CASH-03: Xác nhận Thu tiền mặt & Tự động ghi Sổ Quỹ (CASH_IN_COLLECT)
* **Given:** Request đặt phòng tại quầy gửi lên backend hợp lệ.
* **When:** Hệ thống xử lý trong database transaction:
  * Chuyển trạng thái booking sang `CONFIRMED_PAID`.
  * Chuyển trạng thái thanh toán sang `PAID` với `payment_method = 'CASH_ON_ARRIVAL'`.
  * Khóa slot phòng họp vĩnh viễn với trạng thái `BOOKED`.
* **Then:** Hệ thống tự động chèn một bản ghi phiếu thu vào bảng `CASH_BOOK_LOGS` với `entry_type = 'CASH_IN_COLLECT'`, số tiền tương ứng, ID của lễ tân thực hiện và ngày ca trực `CURRENT_DATE`.
* **And:** Frontend hiển thị Modal biên nhận thành công gồm: Mã đặt phòng, Mã phiếu thu sổ quỹ, thông tin phòng và nút *"🖨️ In Biên Nhận"*.

### 1.4. AC-CASH-04: Phân quyền vai trò người dùng (RBAC Enforcement)
* **Given:** Một người dùng mang vai trò `CUSTOMER` gửi request `POST /api/v1/bookings` với `payment_method = 'CASH_ON_ARRIVAL'`.
* **When:** API Gateway hoặc Booking Service kiểm tra vai trò.
* **Then:** Hệ thống từ chối thực thi và trả về mã lỗi HTTP 403 `PAYMENT_METHOD_FORBIDDEN`.
* **And:** Tuyệt đối không sinh slot giữ chỗ hay phiếu thu trong sổ quỹ.

---

## 2. Luồng 2: Hủy Đơn Phân Tầng & Duyệt OTP Hoàn Tiền Mặt (Two-Man Rule)

### 2.1. AC-REFUND-01: Tính toán tỷ lệ hoàn tiền và phí phạt phân tầng
* **Given:** Đơn đặt phòng đang ở trạng thái hợp lệ (`CONFIRMED`, `CONFIRMED_PAID`, `CONFIRMED_DEBT`).
* **When:** Người dùng hoặc Lễ tân kích hoạt Modal hủy phòng.
* **Then:** Hệ thống tự động tính khoảng cách thời gian giữa thời điểm hiện tại và giờ bắt đầu cuộc họp (`start_time - now`):
  * **Mốc 1 ($\ge 24$ giờ):** Hoàn $100\%$ tiền, phí phạt vi phạm thời hạn $= 0\%$.
  * **Mốc 2 ($2\text{h} \le \text{thời gian} < 24\text{h}$):** Hoàn $80\%$ tiền, thu phí phạt giữ chỗ $= 20\%$.
  * **Mốc 3 ($< 2$ giờ):** Hoàn $0\%$ tiền, thu phí phạt hủy sát giờ $= 100\%$ (Chuyển trạng thái `CANCELLED_NO_REFUND`).

### 2.2. AC-REFUND-02: Kiểm soát giới hạn hủy phòng miễn phạt trong tháng
* **Given:** Người dùng đã có $\ge 2$ lần hủy phòng trong tháng hiện tại.
* **When:** Người dùng yêu cầu hủy tiếp lần thứ 3 trở đi cho đơn họp thuộc Mốc 1 hoặc Mốc 2.
* **Then:** Hệ thống tự động phạt thêm $30\%$ phí hủy thường xuyên và trần hoàn tiền tối đa không vượt quá $70\%$.

### 2.3. AC-REFUND-03: Quy tắc kiểm soát 2 người cho tiền mặt (Two-Man Rule Enforcement)
* **Given:** Đơn đặt phòng ban đầu thanh toán bằng `CASH_ON_ARRIVAL`, trạng thái `CONFIRMED_PAID`, và số tiền hoàn sau khi tính phạt $> 0$ VNĐ.
* **When:** Lễ tân mở Modal hủy phòng (`RefundModal.tsx`).
* **Then:** Hệ thống bắt buộc kích hoạt khu vực xác thực **Two-Man Rule**:
  * Hiển thị cảnh báo: *"Lễ tân không được tự ý xuất quỹ tiền mặt. Bắt buộc có mã OTP phê duyệt từ Quản lý ca trực."*
  * Hiển thị trường nhập mã OTP 6 chữ số (`#refund-otp-input`) và nút *"Gửi OTP Quản Lý"*.
* **And:** Hệ thống dispatch mã OTP bảo mật 6 số (mô phỏng `888999` hoặc `123456`) tới số điện thoại/thiết bị của Quản lý ca trực (Shift Supervisor) kèm thời hạn hiệu lực 60 giây.

### 2.4. AC-REFUND-04: Xử lý ngoại lệ mã OTP Quản lý ca trực
* **Kịch bản Thiếu OTP:**
  * Given Lễ tân bấm *"Xác Nhận Hủy & Hoàn Tiền"* mà chưa nhập mã OTP Quản lý.
  * Then hệ thống chặn request tại giao diện và hiển thị lỗi: *"Quy tắc Two-Man Rule: Yêu cầu nhập mã OTP từ Quản lý ca trực để duyệt chi hoàn tiền mặt."* (Mã lỗi backend: HTTP 400 `OTP_REQUIRED`).
* **Kịch bản Sai OTP:**
  * Given Lễ tân nhập mã OTP không trùng khớp với mã OTP của Quản lý ca trực.
  * When bấm xác nhận hoàn tiền.
  * Then hệ thống từ chối thực hiện, giữ nguyên trạng thái booking và hiển thị cảnh báo: *"Mã OTP duyệt chi của Quản lý ca trực không chính xác hoặc đã hết hạn."* (Mã lỗi backend: HTTP 400 `INVALID_OTP`).
  * And tuyệt đối không được xuất phiếu chi tiền mặt.

### 2.5. AC-REFUND-05: Duyệt chi thành công & Hoàn tất thủ tục sổ quỹ
* **Given:** Lễ tân nhập chính xác mã OTP Quản lý ca trực (`888999` hoặc `123456`) và bấm xác nhận.
* **When:** Backend tiếp nhận request trong database transaction:
  * Cập nhật trạng thái booking sang `CANCELLED`.
  * Cập nhật số tiền hoàn `refund_amount` và lưu ID người duyệt `supervisor_otp_approved_by`.
  * Giải phóng slot phòng họp trở lại trạng thái `AVAILABLE`.
* **Then:** Hệ thống tự động chèn một bản ghi phiếu chi vào bảng `CASH_BOOK_LOGS` với `entry_type = 'CASH_OUT_REFUND'`, số tiền hoàn trả khách, ghi nhận ID Lễ tân và ID Quản lý ca trực phê duyệt.
* **And:** Modal hiển thị phiếu chi hoàn tất gồm: Mã đặt phòng, Tỷ lệ hoàn, Tiền hoàn trả khách, Mã phiếu chi sổ quỹ (`CASH-OUT-...`) và nút in phiếu chi đối soát.
