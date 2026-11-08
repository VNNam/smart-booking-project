# Review — `frontend/admin/pages/cash-booking.tsx` vs. Calendar Logic & Cash Payment Rules

**Ngày:** 2026-11-08 16:34 (UTC+7) · **Commit:** `164841f` / `a786814`
**Rules kiểm tra:** Module 2 (Current/Future date) + Module 3.1 (không thu tiền mặt cho khung giờ đã qua, cập nhật trạng thái phòng lập tức)

## 1. Usecase Analysis
Lễ tân mở trang → chọn ngày → hệ thống hiển thị slot trống (today: từ `now` trở đi; future: cả ngày) → chọn slot → nhập khách → "Xác nhận & Đã thu tiền mặt" → `POST /api/v1/bookings (CASH_ON_ARRIVAL)` → slot `BOOKED`, ghi `CASH_IN_COLLECT`.

## 2. Kết quả review

### ✅ Đạt
| Rule | Bằng chứng |
|---|---|
| Today: ẩn khung giờ quá khứ | L160–164 `tf.startMinutes > currentMinutes` |
| Future: hiển thị toàn bộ khung giờ | L165–166 |
| Chặn ngày quá khứ | `min={todayStr}` L402, banner L411, nút disabled L678 |
| Idempotency-Key gửi kèm request | L264, L281 |
| Server ghi slot BOOKED + sổ quỹ trong 1 transaction | `BookingService.ts` L340–370 |

### ❌ Phát hiện lỗi
| ID | Sev | Vấn đề | Vị trí | Tác động | Đề xuất sửa |
|---|---|---|---|---|---|
| CB-01 | **S1** | **Nhánh `catch` giả lập THÀNH CÔNG** khi fetch lỗi mạng/backend sập: hiển thị biên nhận, đánh dấu slot BOOKED | L314–328 | Lễ tân thu tiền thật nhưng **không có booking & không có phiếu thu trong DB** → lệch quỹ, double booking | Xóa nhánh mock hoặc chỉ bật khi `process.env.NEXT_PUBLIC_MOCK_API === 'true'`; production phải hiển thị lỗi và **không** cho xác nhận đã thu |
| CB-02 | **S1** | Danh sách slot **không tự làm mới theo thời gian**: `now` chỉ tính khi effect chạy (deps `[rooms, selectedDate, ...]`) | L139–192 | Mở trang lúc 16:50 → slot 17:00 vẫn chọn & thu tiền được lúc 17:30 | `setInterval` 30–60s cập nhật `nowTick` vào deps; tự bỏ chọn `selectedSlot` nếu đã quá giờ |
| CB-03 | **S1** | **Không re-validate tại thời điểm submit** (client) | `handleConfirmCashBooking` L247–260 | Kết hợp CB-02 → thu tiền slot đã qua | Trước khi gửi: `if (isToday && slotStart <= now) → lỗi "Khung giờ đã qua"` |
| CB-04 | **S1** | **Backend không chặn slot quá khứ** (G-14): `createBooking` không check `start_time > now()` và bỏ qua `slot_status` | `BookingService.ts` L137–151 | Client guard bị bypass bằng gọi API trực tiếp | Thêm `AND s.status='AVAILABLE' AND s.start_time > now()` vào query; 0 rows → `409 SLOT_IN_PAST_OR_UNAVAILABLE` |
| CB-05 | S2 | Slot giả lập, **ID phụ thuộc chỉ số sau lọc** `slot-${roomId}-${tfIdx}`; slot "BOOKED" hardcode `rIdx===0 && tfIdx===1` | L170–177 | Hôm nay (còn 17:00, 19:00) thì slot **19:00** bị đánh BOOKED; ngày mai lại là 10:00 → dữ liệu không nhất quán; `slotId` gửi lên server không phải UUID thật → luôn 404 | Gọi `GET /slots/available?roomId&date` lấy slot thật từ DB |
| CB-06 | S2 | Trạng thái BOOKED chỉ lưu trong state cục bộ; đổi ngày rồi quay lại → slot lại AVAILABLE; tab khác/`CalendarGrid` không được đồng bộ | L303, L182 | Vi phạm "đồng bộ thời gian thực với lịch trống" | Refetch sau khi thành công + đẩy sự kiện (SSE/WebSocket hoặc polling) |
| CB-07 | S2 | Idempotency-Key **sinh mới mỗi lần bấm** | L264 | Timeout rồi bấm lại = request mới → nguy cơ tạo 2 phiếu thu (server chỉ chặn bằng unique slot) | Sinh key khi chọn slot, giữ nguyên cho đến khi thành công/đổi slot |
| CB-08 | S2 | Thời gian "hiện tại" lấy theo **đồng hồ máy lễ tân** (`new Date()`), không theo giờ VN/server | L141–142, L87 | Máy sai giờ/timezone → hiển thị sai slot | Dùng giờ server (header `Date` hoặc `/time`) và quy đổi `Asia/Ho_Chi_Minh` |
| CB-09 | S2 | Số tiền hiển thị/biên nhận tính ở client (weekend +15% theo chuỗi `'Cuối tuần'`), server tính **không** có phụ thu | L225–237 vs `BookingService.ts` L154–155 | Lễ tân thu 805.000đ, sổ quỹ ghi 700.000đ → lệch quỹ | Biên nhận dùng `data.totalAmount` từ server; pricing engine chỉ ở backend |
| CB-10 | S3 | `Authorization: Bearer mock-staff-jwt-token` hardcode | L283 | Không dùng token phiên đăng nhập thật | Lấy từ `AuthManager` |
| CB-11 | S3 | `todayStr` tính 1 lần mỗi render; qua 00:00 không đổi nếu không re-render | L87 | Sau nửa đêm, "hôm qua" vẫn coi là hôm nay | Gộp vào cơ chế tick của CB-02 |
| CB-12 | S3 | Slot đang diễn ra (vd. 15:00–17:00 lúc 16:32) bị ẩn | L163 | Có thể là chủ đích; chưa có trong BRD | Chờ PO quyết định (Open Question #5 trong BA analysis) |

## 3. Cross-module Impact
- **Lịch trống (M2):** CB-02/05/06 khiến lịch hiển thị trên trang thu tiền khác với `CalendarGrid` và mobile.
- **Kế toán (M3):** CB-01 và CB-09 tạo chênh lệch giữa tiền thực thu và `cash_book_logs` → đối soát theo khoảng ngày sẽ báo lệch.
- **Hạn mức (M1):** trang này chưa hỗ trợ luồng fallback "member vượt hạn mức → trả tiền mặt" (không có trường tra cứu member/công ty để gắn booking cho đúng `user_id`; server hiện gắn `user_id` = lễ tân).

## 4. Test Cases
| ID | Loại | Bước | Kết quả mong đợi | Hiện tại |
|---|---|---|---|---|
| TC-CB01 | Happy | 16:32, chọn hôm nay | Chỉ hiện 17:00, 19:00 | ✅ |
| TC-CB02 | Happy | Chọn 2026-11-12 | Đủ 6 khung 08:00–21:00 | ✅ (nhưng là dữ liệu giả) |
| TC-CB03 | Edge | Mở trang 16:55, chọn 17:00, đợi đến 17:05 rồi submit | Bị chặn "Khung giờ đã qua"; slot biến mất | ❌ vẫn thu được (CB-02/03) |
| TC-CB04 | Edge | Gọi API `POST /bookings` CASH với slot `start_time` = hôm nay 08:00 | 409 | ❌ 201 (CB-04) |
| TC-CB05 | Error | Tắt backend, bấm xác nhận | Báo lỗi, không hiển thị biên nhận | ❌ hiển thị biên nhận thành công (CB-01) |
| TC-CB06 | Edge | Thứ Bảy, phòng 350k/h, 2h | Biên nhận = sổ quỹ = 805.000đ | ❌ lệch 105.000đ (CB-09) |
| TC-CB07 | Concurrency | 2 lễ tân cùng chọn 1 slot, cùng submit | 1 thành công, 1 nhận 409 | ✅ ở server (unique index) |
| TC-CB08 | Idempotency | Timeout mạng, bấm lại | Không tạo đơn/phiếu thu thứ hai | ❌ key mới mỗi lần (CB-07) |

## 5. Kết luận
Logic hiển thị Module 2 **đạt ở mức UI**, nhưng quy tắc "không thu tiền mặt cho khung giờ đã qua" **chưa được bảo đảm** (thiếu tick thời gian, thiếu re-validate khi submit, và quan trọng nhất là thiếu guard phía server). CB-01, CB-04, CB-09 cần sửa **trước UAT** vì gây sai lệch tiền thật.

