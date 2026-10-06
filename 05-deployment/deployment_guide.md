# 🛠️ CẨM NANG TRIỂN KHAI UAT CHI PHÍ $0 (ZERO-COST UAT DEPLOYMENT GUIDE)

**Dự án:** Smart Meeting Room Booking System  
**Phiên bản hệ thống:** v1.4 Hardened  
**Biên soạn bởi:** `@Dev_Agent`  
**Ngày lập:** 2026-10-07  
**Dành cho:** Kỹ sư Vận hành (DevOps / Human Operator) triển khai hệ thống lên hạ tầng đám mây miễn phí 100%.

---

## 📑 MỤC LỤC
1. [Chuẩn bị Tiền đề (Prerequisites)](#1-chuẩn-bị-tiền-đề-prerequisites)
2. [Bước 1: Khởi tạo Cơ sở Dữ liệu Neon PostgreSQL ($0)](#bước-1-khởi-tạo-cơ-sở-dữ-liệu-neon-postgresql-0)
3. [Bước 2: Khởi tạo Bộ nhớ đệm Upstash Redis ($0)](#bước-2-khởi-tạo-bộ-nhớ-đệm-upstash-redis-0)
4. [Bước 3: Triển khai Backend API lên Render ($0)](#bước-3-triển-khai-backend-api-lên-render-0)
5. [Bước 4: Triển khai Frontend Web Admin lên Vercel ($0)](#bước-4-triển-khai-frontend-web-admin-lên-vercel-0)
6. [Bước 5: Bảng Tham chiếu Biến Môi trường (.env)](#bước-5-bảng-tham-chiếu-biến-môi-trường-env)
7. [Bước 6: Khởi chạy Di chuyển Dữ liệu (Database Migration)](#bước-6-khởi-chạy-di-chuyển-dữ-liệu-database-migration)
8. [Bước 7: Kiểm tra Sức khỏe Hệ thống (Verification & Health Check)](#bước-7-kiểm-tra-sức-khỏe-hệ-thống-verification--health-check)

---

## 1. Chuẩn bị Tiền đề (Prerequisites)

Trước khi thực hiện, Người vận hành cần chuẩn bị các tài khoản dịch vụ miễn phí sau (chỉ cần đăng ký bằng tài khoản GitHub, **KHÔNG CẦN NHẬP THẺ TÍN DỤNG**):
1. **GitHub Account:** Chứa repository mã nguồn của dự án.
2. **Neon.tech Account:** Đăng ký miễn phí tại [https://neon.tech](https://neon.tech).
3. **Upstash Account:** Đăng ký miễn phí tại [https://upstash.com](https://upstash.com).
4. **Render Account:** Đăng ký miễn phí tại [https://render.com](https://render.com).
5. **Vercel Account:** Đăng ký miễn phí tại [https://vercel.com](https://vercel.com).

---

## Bước 1: Khởi tạo Cơ sở Dữ liệu Neon PostgreSQL ($0)

1. Đăng nhập vào **Neon Console** -> Nhấn **"Create Project"**.
2. Đặt tên Project: `smart-booking-uat`.
3. Chọn khu vực (Region): Ưu tiên **Singapore (`ap-southeast-1`)** để đạt độ trễ thấp nhất về Việt Nam.
4. Chọn phiên bản PostgreSQL: **PostgreSQL 16**.
5. Nhấn **"Create Project"**.
6. Tại màn hình Dashboard, tìm mục **Connection Details**:
   * Tích chọn mục **"Connection pooling"** (rất quan trọng để kích hoạt PgBouncer).
   * Sao chép chuỗi kết nối dạng:
     ```text
     postgresql://smart_user:password123@ep-cool-snowflake-123456-pooler.ap-southeast-1.aws.neon.tech/smart_booking_db?sslmode=require
     ```
   * *Lưu ý:* Lưu lại chuỗi này để cấu hình biến `DATABASE_URL`.

---

## Bước 2: Khởi tạo Bộ nhớ đệm Upstash Redis ($0)

1. Đăng nhập vào **Upstash Console** -> Chọn tab **Redis** -> Nhấn **"Create Database"**.
2. Nhập thông tin:
   * **Name:** `smart-booking-redis-uat`.
   * **Type:** Regional.
   * **Region:** Chọn cùng khu vực với Database: **AP-Southeast-1 (Singapore)**.
   * **Eviction:** Tắt (Disable - để Redis duy trì dữ liệu phiên và lock an toàn).
3. Nhấn **"Create"**.
4. Sau khi tạo xong, cuộn xuống phần **"Connect your database"**:
   * Chọn tab **`ioredis`** hoặc **`Node.js`**.
   * Sao chép chuỗi kết nối bắt đầu bằng `rediss://` (kết nối bảo mật TLS trên cổng 6379), ví dụ:
     ```text
     rediss://default:AbCdEfGh123456@ap1-clean-tiger-12345.upstash.io:6379
     ```
   * *Lưu ý:* Lưu lại chuỗi này để cấu hình biến `REDIS_URL`.

---

## Bước 3: Triển khai Backend API lên Render ($0)

1. Đăng nhập vào **Render Dashboard** -> Nhấn **"New +"** -> Chọn **"Web Service"**.
2. Chọn **"Build and deploy from a Git repository"** -> Kết nối và chọn repository GitHub của dự án.
3. Thiết lập thông số dịch vụ:
   * **Name:** `smart-booking-api-uat`
   * **Region:** Singapore (Southeast Asia).
   * **Branch:** `main` (hoặc nhánh release UAT).
   * **Root Directory:** Để trống (nếu cấu trúc mono-repo thì chỉ định `.` hoặc thư mục backend tương ứng).
   * **Runtime:** `Node`.
   * **Build Command:**
     ```bash
     npm install && npm run build
     ```
   * **Start Command:**
     ```bash
     npm run start:prod
     ```
   * **Instance Type:** Chọn **Free ($0/month)**.
4. Cuộn xuống mục **"Advanced"** -> Nhấn **"Add Environment Variable"** và điền các biến cấu hình từ [Mục 5](#bước-5-bảng-tham-chiếu-biến-môi-trường-env).
5. Nhấn **"Create Web Service"**.
6. Quá trình build và khởi động sẽ diễn ra trong khoảng 2–3 phút. Sau khi hoàn tất, Render sẽ cấp một tên miền công khai dạng:
   `https://smart-booking-api-uat.onrender.com`

---

## Bước 4: Triển khai Frontend Web Admin lên Vercel ($0)

1. Đăng nhập vào **Vercel Dashboard** -> Nhấn **"Add New..."** -> Chọn **"Project"**.
2. Chọn repository GitHub chứa dự án và nhấn **"Import"**.
3. Cấu hình Project:
   * **Project Name:** `smart-booking-admin-uat`
   * **Framework Preset:** `Next.js`
   * **Root Directory:** Nhấn Edit và chọn thư mục: `frontend/admin`
   * **Build and Output Settings:** Giữ mặc định (`npm run build`).
4. Tại phần **Environment Variables**, thêm biến:
   * **Key:** `NEXT_PUBLIC_API_URL`
   * **Value:** URL của backend Render vừa tạo ở Bước 3 (ví dụ: `https://smart-booking-api-uat.onrender.com/api/v1`).
   * **Key:** `NEXT_PUBLIC_APP_ENV`
   * **Value:** `uat`
5. Nhấn **"Deploy"**.
6. Sau khoảng 60 giây, Vercel sẽ triển khai thành công và cấp tên miền công khai dạng:
   `https://smart-booking-admin-uat.vercel.app`

---

## Bước 5: Bảng Tham chiếu Biến Môi trường (.env)

Kỹ sư vận hành cấu hình chính xác các biến môi trường sau trên Render (`smart-booking-api-uat`):

```ini
# ==============================================================================
# SMART BOOKING PLATFORM - UAT PRODUCTION ENVIRONMENT VARIABLES ($0 FREE-TIER)
# ==============================================================================

# Cấu hình Môi trường chung
NODE_ENV=production
PORT=3000
APP_NAME=SmartBookingSystem-UAT
APP_URL=https://smart-booking-api-uat.onrender.com

# Cơ sở dữ liệu PostgreSQL (Neon.tech Pooled Connection String)
# Bắt buộc có ?sslmode=require và domain chứa -pooler
DATABASE_URL=postgresql://smart_user:password123@ep-cool-snowflake-123456-pooler.ap-southeast-1.aws.neon.tech/smart_booking_db?sslmode=require
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000

# Bộ nhớ đệm & Khóa phân tán (Upstash Redis TLS)
# Bắt buộc tiền tố rediss://
REDIS_URL=rediss://default:AbCdEfGh123456@ap1-clean-tiger-12345.upstash.io:6379

# Khóa bảo mật & Idempotency
JWT_SECRET=c8f8b3c2980173295847e098df241746b149b1093847af2b6839174628394018
JWT_EXPIRES_IN=8h
IDEMPOTENCY_TTL_SECONDS=86400

# Quy tắc Nghiệp vụ BRD v1.4 Hardened
LOCK_TTL_SECONDS=600
CANCELLATION_FREE_MONTHLY_LIMIT=2
SUPERVISOR_OTP_BYPASS_DEV=false

# Cổng Thanh toán VNPAY Sandbox (Test Mode)
VNPAY_TMN_CODE=SMARTUAT1
VNPAY_HASH_SECRET=RAHDefaultSecretKeyMockSandboxUAT2026
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://smart-booking-admin-uat.vercel.app/payment-callback

# Mock Webhook Secret
WEBHOOK_SECRET_KEY=whsec_mock_uat_testing_key_2026
```

---

## Bước 6: Khởi chạy Di chuyển Dữ liệu (Database Migration)

Sau khi Database Neon được tạo, tiến hành nạp cấu trúc bảng và dữ liệu khởi tạo từ tệp [src/database/schema_v1.sql](file:///home/nam/smart-booking-project/smart-booking-project/src/database/schema_v1.sql):

### Cách 1: Sử dụng giao diện Web Neon SQL Editor (Nhanh nhất - Không cần cài tool)
1. Truy cập **Neon Console** -> Chọn Project `smart-booking-uat`.
2. Trên thanh menu bên trái, chọn **"SQL Editor"**.
3. Mở tệp `src/database/schema_v1.sql` trong dự án, copy toàn bộ nội dung.
4. Dán vào khung soạn thảo Neon SQL Editor.
5. Nhấn **"Run"** (hoặc `Ctrl + Enter`).
6. Kiểm tra bảng `Tables` để đảm bảo các bảng `rooms`, `time_slots`, `bookings`, `member_wallets`, `corporate_debts`, `cash_drawer_logs`, và `outbox_events` đã được tạo đầy đủ.

### Cách 2: Sử dụng dòng lệnh `psql` trên máy trạm
```bash
# Thay thế chuỗi kết nối bằng DATABASE_URL thực tế từ Neon
psql "postgresql://smart_user:password123@ep-cool-snowflake-123456-pooler.ap-southeast-1.aws.neon.tech/smart_booking_db?sslmode=require" -f ./src/database/schema_v1.sql
```

---

## Bước 7: Kiểm tra Sức khỏe Hệ thống (Verification & Health Check)

Sau khi hoàn tất cấu hình, thực hiện các lệnh kiểm tra sau từ Terminal:

### 1. Kiểm tra API Healthcheck
```bash
curl -i https://smart-booking-api-uat.onrender.com/api/v1/health
```
**Kết quả mong đợi:**
```json
HTTP/2 200
content-type: application/json; charset=utf-8

{
  "status": "ok",
  "environment": "production",
  "database": "connected (PostgreSQL 16 Neon)",
  "redis": "connected (Upstash Redis 7 TLS)",
  "timestamp": "2026-10-07T00:10:00Z"
}
```

### 2. Kiểm tra Idempotency Middleware trên Render API
```bash
curl -X POST https://smart-booking-api-uat.onrender.com/api/v1/bookings/hold \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 11111111-2222-3333-4444-555555555555" \
  -d '{"slot_id": "slot-001", "user_id": "usr-test"}'
```

### 3. Thiết lập Uptime Keep-Alive Pre-warming ($0 UptimeRobot)
Để ngăn chặn tình trạng Render Free ngủ đông sau 15 phút không hoạt động trong các buổi UAT:
1. Đăng ký tài khoản miễn phí tại [https://uptimerobot.com](https://uptimerobot.com).
2. Tạo mới Monitor:
   * **Monitor Type:** HTTP(s).
   * **Friendly Name:** Smart Booking UAT KeepAlive.
   * **URL:** `https://smart-booking-api-uat.onrender.com/api/v1/health`.
   * **Monitoring Interval:** 10 minutes (Miễn phí 50 monitors).
3. Lưu Monitor. Render API sẽ luôn giữ trạng thái ấm (Warm) sẵn sàng cho đội Tester.
