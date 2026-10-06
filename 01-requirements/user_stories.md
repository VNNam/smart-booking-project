# Agile Product Backlog - User Stories
**Project:** Smart Meeting Room Booking System  
**BRD Version Alignment:** v1.4 (Post-Audit Hardened)  
**Last Updated:** 2026-10-05  

Tài liệu quản lý danh sách các câu chuyện người dùng (User Stories) của dự án **Smart Meeting Room Booking System**, đã được bổ sung các cơ chế phòng vệ chống gian lận, quy tắc kiểm soát 2 người (Two-Man Rule) và chính sách hủy phòng phân tầng theo BRD v1.4.

---

## 1. Phân hệ Khách hàng & Thành viên (Mobile App)

### US-01: Đăng ký & Đăng nhập
- **Là một:** Khách vãng lai hoặc Thành viên tổ chức
- **Tôi muốn:** Đăng nhập nhanh bằng số điện thoại (OTP) hoặc tài khoản Google/OAuth2
- **Để:** Tiết kiệm thời gian thao tác và truy cập lịch đặt phòng cá nhân.
- **Priority:** Must Have | **Estimate:** 5 SP
- **Acceptance Criteria:**
  - [ ] Nhận OTP qua SMS trong vòng 30 giây.
  - [ ] Đăng nhập bằng Google OAuth2 / Apple Sign-in.
  - [ ] Tạo session JWT an toàn, refresh token tự động.

### US-02: Tìm kiếm & Tra cứu Phòng họp trống
- **Là một:** Khách hàng (End-User) hoặc Thành viên (Member)
- **Tôi muốn:** Lọc phòng theo chi nhánh, sức chứa, khung giờ trống và trang thiết bị (máy chiếu, bảng trắng)
- **Để:** Chọn phòng họp phù hợp nhất với nhu cầu hội họp trong < 60 giây.
- **Priority:** Must Have | **Estimate:** 8 SP
- **Acceptance Criteria:**
  - [ ] Hiển thị danh sách phòng họp kèm trạng thái khả dụng thời gian thực.
  - [ ] Không hiển thị hoặc làm mờ các phòng đang bị khóa (`LOCKED_PENDING_ONLINE`) hoặc đã đặt (`CONFIRMED`).

### US-03: Đặt phòng & Thanh toán Trực tuyến (Online Payment Flow - 10 phút TTL)
- **Là một:** Khách vãng lai (End-User) trên Mobile App
- **Tôi muốn:** Khóa phòng tạm thời trong 10 phút (600 giây) để thực hiện thanh toán qua cổng VNPAY / MoMo / ZaloPay
- **Để:** Có đủ thời gian nhận mã OTP ngân hàng và xác thực sinh trắc học mà không bị hủy phòng giữa chừng.
- **Priority:** Must Have | **Estimate:** 13 SP
- **Acceptance Criteria:**
  - [ ] Khi bấm "Đặt & Thanh toán", hệ thống chuyển trạng thái phòng sang `LOCKED_PENDING_ONLINE` với TTL 10 phút (600s).
  - [ ] Đồng hồ đếm ngược 10 phút hiển thị trên giao diện thanh toán Mobile App.
  - [ ] Nhận webhook thanh toán thành công trong 10 phút: chuyển trạng thái thành `CONFIRMED`, gửi Push Notification và Email xác nhận.
  - [ ] Quá 10 phút không có tín hiệu: tự động hủy khóa phòng, hoàn trả trạng thái về `AVAILABLE`.
  - [ ] Nếu webhook thành công gửi về muộn (Late Webhook) khi phòng đã bị người khác đặt: Hệ thống tự động kích hoạt API hoàn tiền 100% (Auto-Refund) và gửi thông báo xin lỗi.

### US-04: Đặt phòng bằng Ví Thành viên (Prepaid Credit Flow - Chống Double-spending)
- **Là một:** Thành viên đã nạp tiền trước (Pre-paid Member) trên Mobile App
- **Tôi muốn:** Sử dụng số dư ví thành viên (Credit) để thanh toán tức thì cho phòng họp
- **Để:** Đặt phòng nhanh chóng chỉ với 1 chạm mà không cần qua cổng thanh toán trung gian.
- **Priority:** Must Have | **Estimate:** 8 SP
- **Acceptance Criteria:**
  - [ ] Gửi kèm header `Idempotency-Key` để tránh bị trừ tiền 2 lần khi click đúp.
  - [ ] Hệ thống thực hiện Pessimistic Lock (`SELECT ... FOR UPDATE`) trên bản ghi ví.
  - [ ] Kiểm tra số dư ví hiện tại `wallet_balance >= room_price`.
  - [ ] Nếu đủ số dư: trừ trực tiếp số dư, tạo booking trạng thái `CONFIRMED` ngay lập tức, lưu bản ghi vào `OUTBOX_EVENTS`.
  - [ ] Nếu không đủ số dư: từ chối giao dịch với mã lỗi HTTP 402, hiển thị popup thông báo số dư không đủ.

### US-05: Khách tự Hủy phòng Phân tầng & Chống găm phòng (Multi-tiered Cancellation)
- **Là một:** Khách hàng hoặc Thành viên đã đặt phòng thành công
- **Tôi muốn:** Tự hủy phòng họp trực tiếp trên Mobile App với chính sách hoàn tiền công bằng
- **Để:** Nhận lại tiền/số dư ví tương ứng thời gian báo trước.
- **Priority:** Must Have | **Estimate:** 8 SP
- **Acceptance Criteria:**
  - [ ] **Hủy trước $\ge 24$ giờ:** Hoàn tiền 100% (hoàn qua cổng hoặc cộng lại vào Ví). Phòng chuyển về `AVAILABLE`.
  - [ ] **Hủy từ 2 giờ đến dưới 24 giờ:** Phạt 20% phí giữ phòng, chỉ hoàn 80% số tiền đã thanh toán.
  - [ ] **Hủy dưới 2 giờ:** Không hoàn tiền (0% hoàn tiền, trạng thái `CANCELLED_NO_REFUND`), phòng mở lại `AVAILABLE`.
  - [ ] **Giới hạn chống lạm dụng:** Mỗi tài khoản chỉ được miễn phạt tối đa 2 lần hủy/tháng. Từ lần thứ 3 trở đi, tự động phạt 30% phí hủy bất kể thời gian hủy trước bao lâu.

---

## 2. Phân hệ Quản lý & Lễ tân (Web Admin Dashboard)

### US-06: Đặt phòng tại quầy thu Tiền mặt (Cash on Arrival - Walk-in Flow)
- **Là một:** Lễ tân / Quản lý tòa nhà trên Web Admin
- **Tôi muốn:** Tạo booking trực tiếp cho khách vãng lai đến quầy và xác nhận thu tiền mặt
- **Để:** Phục vụ khách hàng walk-in chưa tải ứng dụng hoặc muốn thanh toán tiền mặt.
- **Priority:** Must Have | **Estimate:** 8 SP
- **Acceptance Criteria:**
  - [ ] Tính năng chỉ hiển thị trên Web Admin, không cho phép trên Mobile App (HTTP 403 Forbidden nếu Customer gọi API).
  - [ ] Lễ tân chọn phòng, chọn phương thức "Tiền mặt", nhập thông tin khách và bấm "Xác nhận & Đã thu tiền".
  - [ ] Hệ thống cập nhật booking sang trạng thái `CONFIRMED_PAID` đồng bộ tức thì.
  - [ ] Tự động ghi nhận giao dịch thu tiền mặt `CASH_IN_COLLECT` vào sổ quỹ hệ thống `CASH_BOOK_LOGS`.

### US-07: Đặt phòng Thanh toán Sau có Kiểm soát Hạn mức (Postpaid Debt with Credit Limit)
- **Là một:** Lễ tân / Quản lý tòa nhà trên Web Admin
- **Tôi muốn:** Tạo booking cho khách VIP hoặc các phòng ban nội bộ công ty theo hình thức công nợ
- **Để:** Giữ phòng họp nhanh chóng mà vẫn bảo đảm kiểm soát rủi ro tài chính của doanh nghiệp.
- **Priority:** Must Have | **Estimate:** 5 SP
- **Acceptance Criteria:**
  - [ ] Lễ tân chọn tài khoản doanh nghiệp công nợ.
  - [ ] Hệ thống kiểm tra: `current_debt + room_price <= credit_limit`.
  - [ ] Nếu hợp lệ: chuyển trạng thái booking sang `CONFIRMED_DEBT`, cộng dồn `current_debt`.
  - [ ] Nếu vượt hạn mức: chặn tạo booking, trả về mã lỗi HTTP 422 `CREDIT_LIMIT_EXCEEDED` kèm thông báo dư nợ hiện tại.

### US-08: Hủy phòng Tiền mặt có Duyệt OTP Quản lý ca (Two-Man Rule Cash Refund)
- **Là một:** Lễ tân và Quản lý ca trực (Shift Supervisor) trên Web Admin
- **Tôi muốn:** Yêu cầu xác thực OTP từ Quản lý ca trước khi hoàn tiền mặt cho đơn hủy tại quầy
- **Để:** Triệt tiêu hoàn toàn nguy cơ gian lận giả mạo phiếu chi hoàn tiền mặt.
- **Priority:** Must Have | **Estimate:** 8 SP
- **Acceptance Criteria:**
  - [ ] Khi Lễ tân bấm "Hủy & Hoàn tiền mặt" cho đơn `CONFIRMED_PAID`, hệ thống kích hoạt yêu cầu phê duyệt và gửi mã OTP 6 số đến số điện thoại của Quản lý ca trực.
  - [ ] Giao diện Web Admin hiển thị modal nhập mã OTP phê duyệt.
  - [ ] Lễ tân nhập đúng mã OTP được cấp bởi Quản lý: Đơn chuyển sang `CANCELLED`, hệ thống tự động sinh bản ghi chi tiền `CASH_OUT_REFUND` vào `CASH_BOOK_LOGS` kèm `approved_by_supervisor_id`.
  - [ ] Nếu nhập sai OTP quá 3 lần: Khóa luồng hoàn tiền và ghi nhận cảnh báo bảo mật vào `AUDIT_LOGS`.

---

## 3. Phân hệ Kế toán & Quản trị Hệ thống (Admin & Accounting)

### US-09: Quản lý Hạn mức Tín dụng & Đối soát Sổ quỹ
- **Là một:** Kế toán (Accounting) trên Web Admin
- **Tôi muốn:** Thiết lập hạn mức công nợ cho từng doanh nghiệp và đối soát phiếu thu/chi tiền mặt theo từng ca trực
- **Để:** Quản trị rủi ro nợ xấu và bảo đảm số dư sổ quỹ tiền mặt khớp 100% với két tiền thực tế.
- **Priority:** Should Have | **Estimate:** 8 SP
- **Acceptance Criteria:**
  - [ ] Giao diện quản lý `credit_limit` theo từng tài khoản doanh nghiệp.
  - [ ] Báo cáo chốt ca sổ quỹ hiển thị đầy đủ tổng thu (`CASH_IN_COLLECT`), tổng chi hoàn tiền (`CASH_OUT_REFUND`) kèm danh sách người duyệt OTP.
  - [ ] Xuất báo cáo đối soát ra file Excel có chữ ký số.
