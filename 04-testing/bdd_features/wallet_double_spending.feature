# language: vi
Tính năng: Phòng chống tấn công tiêu âm tiền ví và kiểm soát đồng thời (Anti Double-Spending & Concurrency)
  Là một Kỹ sư Kiểm thử Bảo mật (Security QA)
  Tôi muốn thực thi các bài kiểm tra tấn công đồng thời (Race Condition) lên số dư Ví Thành viên
  Để đảm bảo hệ thống khóa dòng dữ liệu thành công và không bao giờ xảy ra tình trạng số dư âm hoặc đặt thừa phòng

  Bối cảnh:
    Có thành viên "Nguyen Hacker" với vai trò "MEMBER" có số dư ví khả dụng là 400.000 VND
    Và phòng họp "Room Alpha" có giá thuê là 350.000 VND
    Và phòng họp "Room Beta" có giá thuê là 350.000 VND
    Và cả hai phòng đều đang ở trạng thái AVAILABLE cùng khung giờ 14:00 - 15:00 ngày 2026-10-30

  Kịch bản: Tấn công Double-Spending bằng 2 request song song trong 5 mili-giây
    Giả sử thành viên sử dụng công cụ kiểm thử gửi 2 yêu cầu HTTP POST "/api/v1/bookings" gần như đồng thời:
      | Request ID | Target Room | Payment Method | Idempotency-Key | Amount |
      | REQ-01     | Room Alpha  | PREPAID_WALLET | IDEMP-KEY-001   | 350000 |
      | REQ-02     | Room Beta   | PREPAID_WALLET | IDEMP-KEY-002   | 350000 |
    Khi hệ thống kích hoạt cơ chế khóa dòng Pessimistic Locking "SELECT ... FOR UPDATE" trên bảng "member_wallets"
    Thì giao dịch REQ-01 chiếm được khóa CSDL trước và hoàn tất trừ 350.000 VND
    Và đơn đặt phòng cho "Room Alpha" chuyển thành công sang trạng thái "CONFIRMED"
    Và số dư ví còn lại của thành viên cập nhật thành 50.000 VND
    Và khi giao dịch REQ-02 được giải phóng khóa để xử lý:
      Hệ thống kiểm tra số dư hiện tại (50.000 VND) nhỏ hơn giá phòng "Room Beta" (350.000 VND)
    Thì giao dịch REQ-02 bị từ chối với mã lỗi HTTP 402 Payment Required
    Và mã lỗi nghiệp vụ trả về là "INSUFFICIENT_WALLET_BALANCE"
    Và số dư ví của thành viên vẫn giữ nguyên là 50.000 VND
    Và ràng buộc cơ sở dữ liệu "chk_wallet_non_negative" không bị vi phạm (Số dư tuyệt đối không âm)
    Và phòng "Room Beta" vẫn ở trạng thái "AVAILABLE"

  Kịch bản: Thành viên vô tình bấm đúp nút thanh toán (Cơ chế Idempotency-Key)
    Giả sử thành viên gửi yêu cầu REQ-01 với header "Idempotency-Key: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb99"
    Và sau 50 mili-giây do mạng chập chờn, client tự động gửi lại chính xác request REQ-01 với cùng "Idempotency-Key"
    Khi hệ thống tiếp nhận request thứ hai
    Thì API Gateway phát hiện "Idempotency-Key" đã tồn tại trong Redis Cache
    Và hệ thống trả về ngay lập tức kết quả 201 Created của request trước đó từ bộ nhớ đệm
    Và hệ thống KHÔNG thực hiện trừ tiền lần thứ hai trong ví thành viên
    Và chỉ có duy nhất 1 giao dịch được lưu trong bảng "WALLET_TRANSACTIONS"
