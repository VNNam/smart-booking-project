# language: vi
Tính năng: Tự động hoàn tiền khi nhận Webhook trễ sau thời hạn khóa giữ phòng (Saga Auto-Refund for Late Webhook)
  Là một Kiến trúc sư Hệ thống & Kỹ sư QA
  Tôi muốn kiểm thử kịch bản Cổng thanh toán gửi IPN trễ quá thời hạn 10 phút khi slot đã bị người khác đặt
  Để đảm bảo hệ thống không xảy ra xung đột Double-Booking và tự động hoàn trả 100% tiền cho khách hàng

  Bối cảnh:
    Có khách hàng "Tran Van A" đặt phòng "Meeting Room London" giá 500.000 VND khung giờ 10:00 - 12:00 ngày 2026-10-29
    Và đơn đặt phòng BKG-001 được khởi tạo với trạng thái "LOCKED_PENDING_ONLINE" kèm Redis TTL 600 giây (10 phút)
    Và khách hàng "Tran Van A" chuyển hướng sang ứng dụng ngân hàng để thanh toán VNPAY

  Kịch bản: Webhook gửi về trễ sau khi phòng đã bị khách hàng khác chiếm chỗ
    Giả sử do sự cố nghẽn mạng viễn thông khi nhận OTP ngân hàng, khách hàng A mất 10 phút 15 giây để xác nhận trừ tiền
    Và tại mốc 10 phút 00 giây, sự kiện Redis Key Expiry đã giải phóng khóa phòng
    Và đơn BKG-001 của khách A chuyển sang trạng thái "EXPIRED"
    Và tại mốc 10 phút 05 giây, khách hàng "Le Van B" đến đặt phòng "Meeting Room London" và thanh toán thành công bằng ví thành viên
    Và phòng "Meeting Room London" chuyển sang trạng thái "CONFIRMED" thuộc về khách B
    Khi tại mốc 10 phút 20 giây, Cổng thanh toán VNPAY gửi Webhook IPN thông báo: Giao dịch của khách A thành công
    Thì Saga Orchestrator kiểm tra thấy slot phòng "Meeting Room London" đã thuộc về khách B
    Và hệ thống TUYỆT ĐỐI KHÔNG cập nhật trạng thái đơn BKG-001 sang "CONFIRMED"
    Và hệ thống kích hoạt nghiệp vụ bù trừ (Compensating Transaction) qua Auto-Refund Worker
    Và Auto-Refund Worker gửi yêu cầu hoàn tiền 100% (500.000 VND) tới API hoàn tiền của VNPAY
    Và hệ thống lưu trạng thái đơn BKG-001 là "EXPIRED_REFUNDED"
    Và hệ thống gửi thông báo Push Notification / Email xin lỗi khách A kèm thông tin hoàn tiền và mã voucher đền bù
    Và lịch đặt phòng của khách B vẫn được bảo toàn nguyên vẹn không bị ảnh hưởng
