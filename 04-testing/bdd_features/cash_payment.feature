# language: vi
Tính năng: Đặt phòng họp thu tiền mặt tại quầy và quy trình hủy đơn tiền mặt (Admin Walk-in & Cash Cancellation)
  Là một Nhân viên Lễ tân / Quản lý tòa nhà
  Tôi muốn tạo đặt phòng trực tiếp tại quầy và thu tiền mặt từ khách vãng lai
  Để phục vụ khách không dùng ứng dụng và tự động ghi nhận phiếu thu vào sổ quỹ

  Bối cảnh:
    Có nhân viên lễ tân "Tran Thi Le Tan" với tài khoản vai trò "STAFF" đã đăng nhập vào Web Admin
    Và phòng họp "Meeting Room Tokyo" (Sức chứa 10 người) đang ở trạng thái AVAILABLE lúc 09:00 - 11:00 ngày 2026-10-25
    Và giá thuê phòng là 600.000 VND

  Kịch bản: Lễ tân tạo đặt phòng và thu tiền mặt thành công tại quầy
    Khi lễ tân chọn phòng "Meeting Room Tokyo" khung giờ 09:00 - 11:00 ngày 2026-10-25 trên Dashboard Web Admin
    Và lễ tân nhập thông tin khách hàng "Nguyen Van Khach" với số điện thoại "0912345678"
    Và lễ tân chọn phương thức thanh toán "CASH_ON_ARRIVAL"
    Và lễ tân nhận đủ 600.000 VND tiền mặt từ khách và bấm "Xác nhận & Đã thu tiền"
    Thì hệ thống tạo đơn đặt phòng với trạng thái booking_status là "CONFIRMED_PAID"
    Và trạng thái thanh toán payment_status là "PAID"
    Và phòng họp chuyển sang trạng thái "BOOKED" ngay lập tức
    Và hệ thống tự động ghi một bản ghi thu tiền mặt 600.000 VND vào sổ quỹ "CASH_BOOK_LOGS" của ca làm việc
    Và in phiếu biên nhận đặt phòng cho khách hàng tại quầy

  Kịch bản: Người dùng thông thường cố tình gọi API đặt phòng bằng tiền mặt (Phân quyền bảo mật)
    Giả sử một khách hàng có vai trò "CUSTOMER" đang sử dụng Mobile App
    Khi khách hàng gửi yêu cầu API POST "/api/v1/bookings" với phương thức "CASH_ON_ARRIVAL"
    Thì hệ thống từ chối yêu cầu và trả về mã lỗi HTTP 403 Forbidden
    Và thông báo lỗi "Phương thức CASH_ON_ARRIVAL chỉ dành cho Quản lý / Lễ tân trên Web Admin"
    Và không có đơn đặt phòng nào được tạo

  Kịch bản: Admin hủy đơn đặt phòng tiền mặt kèm hoàn tiền mặt
    Giả sử đơn đặt phòng cho khách "Nguyen Van Khach" tại phòng "Meeting Room Tokyo" đang có trạng thái "CONFIRMED_PAID"
    Khi khách hàng đến quầy yêu cầu hủy phòng trước giờ họp
    Và lễ tân mở chi tiết đơn đặt phòng trên Web Admin
    Và lễ tân bấm nút "Hủy phòng" và tích chọn "Hủy & Hoàn tiền mặt"
    Thì trạng thái đơn đặt phòng chuyển thành "CANCELLED"
    Và phòng "Meeting Room Tokyo" khung giờ 09:00 - 11:00 ngày 2026-10-25 lập tức trở lại trạng thái "AVAILABLE"
    Và hệ thống tự động tạo phiếu chi hoàn tiền mặt 600.000 VND vào sổ quỹ "CASH_BOOK_LOGS" trong ngày
    Và ghi log kiểm toán thao tác hủy của lễ tân vào bảng AUDIT_LOGS
