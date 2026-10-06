# language: vi
Tính năng: Chính sách hủy phòng phân tầng và cơ chế chống găm giữ phòng họp (Multi-tiered Cancellation Policy)
  Là một Khách hàng hoặc Thành viên đã đặt phòng họp
  Tôi muốn hủy cuộc hẹn phòng họp khi có việc đột xuất
  Để giải phóng phòng cho người khác và nhận lại tiền hoàn theo chính sách phân tầng công bằng BRD v1.4

  Bối cảnh:
    Có khách hàng "Nguyen Van A" đã có một lịch đặt phòng trạng thái "CONFIRMED"
    Và cuộc họp bắt đầu vào lúc 10:00 ngày 2026-10-26 tại phòng "Executive Room 1"
    Và số tiền đã thanh toán là 1.000.000 VND
    Và tài khoản khách hàng mới hủy 0 lần trong tháng 10/2026

  Kịch bản: Khách hàng tự hủy phòng trước giờ bắt đầu trên 24 giờ (Hoàn tiền 100%)
    Giả sử thời điểm hiện tại là 08:00 ngày 2026-10-25 (cách 26 giờ, lớn hơn 24 giờ)
    Khi khách hàng chọn "Hủy đặt phòng" trên Mobile App và xác nhận lý do hủy
    Thì trạng thái đặt phòng chuyển sang "CANCELLED"
    Và hệ thống kích hoạt hoàn trả tự động 100% số tiền (1.000.000 VND) qua cổng thanh toán/ví thành viên
    Và phòng "Executive Room 1" ngay lập tức trở lại trạng thái "AVAILABLE"
    Và khách hàng nhận được email thông báo đã hủy thành công kèm xác nhận hoàn 1.000.000 VND

  Kịch bản: Khách hàng tự hủy phòng từ 2 giờ đến dưới 24 giờ (Phạt 20% phí giữ chỗ, Hoàn 80%)
    Giả sử thời điểm hiện tại là 20:00 ngày 2026-10-25 (cách 14 giờ, nằm trong khoảng 2h - 24h)
    Khi khách hàng bấm "Hủy đặt phòng" trên Mobile App
    Thì hệ thống hiển thị thông báo: "Hủy trong khoảng 2h - 24h trước giờ họp sẽ chịu phí giữ phòng 20% (200.000 VND). Bạn sẽ được hoàn 80% (800.000 VND)."
    Khi khách hàng bấm "Xác nhận tiếp tục hủy"
    Thì trạng thái đặt phòng chuyển sang "CANCELLED"
    Và số tiền hoàn trả ghi nhận là 800.000 VND
    Và 200.000 VND còn lại được ghi nhận vào doanh thu phí hủy phòng
    Và phòng "Executive Room 1" lập tức mở lại trạng thái "AVAILABLE"

  Kịch bản: Khách hàng tự hủy phòng sát giờ dưới 2 giờ (Không hoàn tiền - 0%)
    Giả sử thời điểm hiện tại là 08:30 ngày 2026-10-26 (cách 1.5 giờ, dưới 2 giờ)
    Khi khách hàng bấm "Hủy đặt phòng" trên Mobile App
    Thì hệ thống hiển thị cảnh báo: "Hủy dưới 2 giờ trước giờ họp sẽ không được hoàn tiền. Bạn có chắc chắn muốn hủy?"
    Khi khách hàng bấm "Tiếp tục hủy phòng"
    Thì trạng thái đặt phòng chuyển sang "CANCELLED_NO_REFUND"
    Và số tiền hoàn trả là 0 VND
    Và phòng "Executive Room 1" được giải phóng về trạng thái "AVAILABLE" cho người khác đặt

  Kịch bản: Khách hàng vượt quá hạn mức 2 lần hủy miễn phí trong tháng (Chống găm phòng đầu cơ)
    Giả sử khách hàng này đã thực hiện hủy phòng 2 lần trong tháng 10/2026
    Và thời điểm hiện tại là 07:00 ngày 2026-10-25 (cách 27 giờ, lớn hơn 24 giờ)
    Khi khách hàng bấm "Hủy đặt phòng" lần thứ 3 trong tháng
    Thì hệ thống hiển thị cảnh báo: "Bạn đã hết 2 lượt hủy miễn phạt trong tháng. Hủy từ lần thứ 3 áp dụng phí 30% (300.000 VND)."
    Khi khách hàng đồng ý hủy
    Thì trạng thái phòng chuyển sang "CANCELLED"
    Và số tiền hoàn trả là 700.000 VND (thay vì 1.000.000 VND)
