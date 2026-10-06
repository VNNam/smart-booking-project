# language: vi
Tính năng: Đặt phòng họp bằng Ví thành viên trả trước (Prepaid Member Wallet)
  Là một Thành viên trả trước (Pre-paid Member)
  Tôi muốn sử dụng số dư ví tài khoản để thanh toán tức thì cho phòng họp
  Để đặt phòng nhanh chóng mà không cần qua cổng thanh toán trung gian

  Bối cảnh:
    Có thành viên "Le Van Thanh Vien" với tài khoản vai trò "MEMBER" đã đăng nhập trên Mobile App
    Và phòng họp "Meeting Room Paris" có giá thuê là 400.000 VND cho khung giờ 15:00 - 17:00 ngày 2026-10-26
    Và khung giờ trên đang ở trạng thái AVAILABLE

  Kịch bản: Thành viên đặt phòng thành công khi số dư ví lớn hơn hoặc bằng giá thuê
    Giả sử ví thành viên hiện tại có số dư khả dụng là 1.000.000 VND
    Khi thành viên chọn phòng "Meeting Room Paris" khung giờ 15:00 - 17:00 ngày 2026-10-26
    Và chọn phương thức thanh toán "PREPAID_WALLET"
    Và bấm nút "Thanh toán bằng Ví"
    Thì hệ thống thực hiện trừ 400.000 VND từ ví thành viên
    Và số dư ví mới của thành viên là 600.000 VND
    Và đơn đặt phòng chuyển ngay sang trạng thái "CONFIRMED" mà không phải chờ thời gian giữ chỗ 5 phút
    Và trạng thái thanh toán là "PAID"
    Và hệ thống ghi nhận một giao dịch loại "DEBIT_BOOKING" vào bảng WALLET_TRANSACTIONS
    Và gửi thông báo xác nhận thành công tới Mobile App

  Kịch bản: Ngoại lệ thành viên không đủ số dư ví để đặt phòng (Insufficient Funds)
    Giả sử ví thành viên hiện tại có số dư khả dụng là 150.000 VND
    Khi thành viên chọn phòng "Meeting Room Paris" khung giờ 15:00 - 17:00 ngày 2026-10-26 (giá 400.000 VND)
    Và chọn phương thức thanh toán "PREPAID_WALLET"
    Và bấm nút "Thanh toán bằng Ví"
    Thì hệ thống từ chối giao dịch và trả về mã lỗi HTTP 402 Payment Required
    Và hiển thị thông báo lỗi "Số dư ví thành viên hiện tại (150.000 VND) không đủ thanh toán phòng (400.000 VND). Vui lòng nạp thêm tiền."
    Và số dư ví của thành viên vẫn giữ nguyên là 150.000 VND
    Và không có đơn đặt phòng nào được tạo
    Và phòng "Meeting Room Paris" khung giờ 15:00 - 17:00 ngày 2026-10-26 vẫn ở trạng thái "AVAILABLE"
    Và ứng dụng hiển thị nút chuyển hướng "Nạp tiền vào ví"

  Kịch bản: Thành viên hủy phòng trước giờ họp trên 2 tiếng và nhận hoàn tiền vào ví
    Giả sử thành viên có một đơn đặt phòng "CONFIRMED" đã thanh toán 400.000 VND bằng ví thành viên
    Và thời gian bắt đầu cuộc họp là 15:00 ngày 2026-10-26
    Và thời điểm thành viên thực hiện thao tác hủy là 10:00 ngày 2026-10-26 (cách 5 tiếng, lớn hơn 2 tiếng)
    Khi thành viên bấm "Hủy phòng" trên Mobile App và xác nhận lý do hủy
    Thì trạng thái đơn đặt phòng chuyển thành "CANCELLED"
    Và hệ thống tự động hoàn trả 100% số tiền (400.000 VND) vào ví thành viên
    Và hệ thống ghi nhận giao dịch hoàn tiền loại "REFUND" vào WALLET_TRANSACTIONS
    Và phòng họp được mở khóa trở lại trạng thái "AVAILABLE"
