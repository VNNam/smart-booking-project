# language: vi
Tính năng: Đặt phòng họp và thanh toán trực tuyến qua cổng thanh toán (Online Payment Flow)
  Là một Khách hàng vãng lai sử dụng Mobile App
  Tôi muốn tạm khóa phòng họp trong 5 phút và thanh toán qua cổng VNPAY / MoMo / ZaloPay
  Để bảo đảm giữ phòng họp và hoàn tất cuộc hẹn tiện lợi

  Bối cảnh:
    Có khách hàng "Nguyen Van A" với vai trò "CUSTOMER" đã đăng nhập trên Mobile App
    Và phòng họp "Meeting Room Silicon" (Sức chứa 8 người) có giá thuê 350.000 VND
    Và khung giờ 14:00 - 16:00 ngày 2026-10-28 đang ở trạng thái AVAILABLE

  Kịch bản: Khách hàng thanh toán trực tuyến thành công trong thời hạn giữ phòng 5 phút
    Khi khách hàng chọn phòng "Meeting Room Silicon" khung giờ 14:00 - 16:00 ngày 2026-10-28 trên Mobile App
    Và bấm nút "Đặt & Thanh toán"
    Thì hệ thống chuyển trạng thái phòng họp sang "LOCKED_PENDING_ONLINE"
    Và thiết lập đồng hồ đếm ngược giữ phòng 5 phút (TTL 300 giây)
    Và hiển thị giao diện chuyển tiếp tới cổng thanh toán "VNPAY"
    Khi khách hàng hoàn tất giao dịch thanh toán 350.000 VND trên cổng VNPAY
    Và hệ thống nhận IPN thông báo giao dịch thành công
    Thì trạng thái đơn đặt phòng chuyển thành "CONFIRMED"
    Và trạng thái thanh toán chuyển thành "PAID"
    Và phòng họp chuyển sang trạng thái "BOOKED"
    Và hệ thống gửi thông báo Push Notification và Email xác nhận cho khách hàng

  Kịch bản: Khách hàng hết hạn 5 phút giữ phòng mà chưa thanh toán xong (Timeout Fallback)
    Khi khách hàng chọn phòng "Meeting Room Silicon" khung giờ 14:00 - 16:00 ngày 2026-10-28
    Và hệ thống chuyển phòng sang trạng thái "LOCKED_PENDING_ONLINE" với thời hạn 5 phút
    Nhưng khách hàng không hoàn tất thanh toán trong vòng 5 phút (300 giây)
    Thì sự kiện Redis Key Expiry được kích hoạt
    Và đơn đặt phòng chuyển sang trạng thái "EXPIRED"
    Và phòng "Meeting Room Silicon" khung giờ 14:00 - 16:00 ngày 2026-10-28 tự động trở lại trạng thái "AVAILABLE"
    Và hệ thống gửi thông báo "Đã hết thời gian thanh toán giữ phòng" tới Mobile App của khách

  Kịch bản: Hai khách hàng cùng bấm đặt một phòng họp cùng thời điểm (Race Condition Prevention)
    Giả sử khách hàng A và khách hàng B cùng xem phòng "Meeting Room Silicon" khung giờ 14:00 - 16:00
    Khi cả hai cùng bấm "Đặt & Thanh toán" tại cùng thời điểm
    Và yêu cầu của khách hàng A đến hệ thống trước khách hàng B 5 mili-giây
    Thì hệ thống khóa phòng cho khách hàng A và trả về mã giữ chỗ kèm URL thanh toán
    Và hệ thống trả về mã lỗi HTTP 409 Conflict cho khách hàng B kèm thông báo "Phòng họp đã được người khác giữ chỗ, vui lòng chọn khung giờ khác"
