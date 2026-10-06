-- ==============================================================================
-- DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
-- DATABASE SCHEMA: v1.4 (PostgreSQL 16)
-- FILE: src/database/schema_v1.sql
-- MÔ TẢ: Khởi tạo toàn bộ cấu trúc bảng, ràng buộc toàn vẹn, chỉ mục hiệu năng
--       và cơ chế phòng vệ kiến trúc:
--       1. Partial Unique Index chống Double-Booking cho Slot phòng họp
--       2. Pessimistic Locking & CHECK (balance >= 0) chống Double-Spending ví
--       3. Transactional Outbox Table (outbox_events) bảo đảm At-least-once delivery
--       4. Hạn mức tín dụng doanh nghiệp (credit_limit & current_debt)
--       5. Sổ quỹ tiền mặt & Phê duyệt 2 người (Two-Man Rule) cho hoàn tiền mặt
-- ==============================================================================

-- 1. KÍCH HOẠT EXTENSION HỖ TRỢ UUID & TỰ ĐỘNG SINH MÃ
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TẠO CÁC KIỂU DỮ LIỆU ĐẶC THÙ (ENUM TYPES)
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('CUSTOMER', 'MEMBER', 'STAFF', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE room_type_enum AS ENUM ('STANDARD', 'EXECUTIVE', 'BOARDROOM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE slot_status_enum AS ENUM ('AVAILABLE', 'LOCKED', 'BOOKED', 'MAINTENANCE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE booking_status_enum AS ENUM (
        'LOCKED_PENDING_ONLINE', 
        'CONFIRMED', 
        'CONFIRMED_PAID', 
        'CONFIRMED_DEBT', 
        'CANCELLED', 
        'CANCELLED_NO_REFUND', 
        'EXPIRED', 
        'EXPIRED_REFUNDED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_enum AS ENUM (
        'ONLINE_GATEWAY', 
        'PREPAID_WALLET', 
        'CASH_ON_ARRIVAL', 
        'POSTPAID_DEBT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_enum AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'UNPAID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE booking_channel_enum AS ENUM ('MOBILE_APP', 'WEB_ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE wallet_tx_type_enum AS ENUM ('TOPUP', 'DEBIT_BOOKING', 'REFUND');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE cash_entry_type_enum AS ENUM ('CASH_IN_COLLECT', 'CASH_OUT_REFUND');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE outbox_status_enum AS ENUM ('PENDING', 'PROCESSED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 3. ĐỊNH NGHĨA CÁC BẢNG DỮ LIỆU CHÍNH (TABLE DEFINITIONS)
-- ==============================================================================

-- 3.1. Bảng Doanh Nghiệp (Companies) - Hỗ trợ Luồng Đặt Phòng Công Nợ
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    tax_code VARCHAR(50) UNIQUE NOT NULL,
    credit_limit DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    current_debt DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Ràng buộc kiểm soát nợ không vượt quá hạn mức tín dụng
    CONSTRAINT chk_company_credit_limit CHECK (current_debt <= credit_limit),
    CONSTRAINT chk_company_debt_non_negative CHECK (current_debt >= 0.00)
);

-- 3.2. Bảng Người Dùng (Users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'CUSTOMER',
    credit_limit DECIMAL(15, 2) NOT NULL DEFAULT 0.00, -- Hạn mức công nợ cá nhân cho VIP
    current_debt DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_user_credit_limit CHECK (current_debt <= credit_limit),
    CONSTRAINT chk_user_debt_non_negative CHECK (current_debt >= 0.00)
);

-- 3.3. Bảng Chi Nhánh (Branches)
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3.4. Bảng Phòng Họp (Rooms)
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    room_type room_type_enum NOT NULL DEFAULT 'STANDARD',
    capacity INT NOT NULL CHECK (capacity > 0),
    hourly_rate DECIMAL(12, 2) NOT NULL CHECK (hourly_rate >= 0),
    amenities JSONB DEFAULT '{"projector": true, "whiteboard": true, "video_conf": false}'::JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3.5. Bảng Khung Giờ Đặt (Slots)
CREATE TABLE IF NOT EXISTS slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status slot_status_enum NOT NULL DEFAULT 'AVAILABLE',
    lock_expires_at TIMESTAMPTZ, -- Hỗ trợ theo dõi TTL lock
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_slot_time_valid CHECK (end_time > start_time)
);

-- 3.6. Bảng Đặt Phòng (Bookings) - TRỌNG TÂM CƠ CHẾ CONCURRENCY
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE RESTRICT,
    booking_code VARCHAR(50) UNIQUE NOT NULL,
    booking_status booking_status_enum NOT NULL DEFAULT 'LOCKED_PENDING_ONLINE',
    payment_method payment_method_enum NOT NULL,
    payment_status payment_status_enum NOT NULL DEFAULT 'PENDING',
    booking_channel booking_channel_enum NOT NULL DEFAULT 'MOBILE_APP',
    total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
    refund_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (refund_amount >= 0),
    corporate_debt_account VARCHAR(100),
    supervisor_otp_approved_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Lưu ID Quản lý duyệt OTP (Two-Man Rule)
    notes TEXT,
    lock_expires_at TIMESTAMPTZ, -- TTL 10 phút (600s) cho luồng Online
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3.7. Bảng Ví Thành Viên (Member Wallets) - CHỐNG DOUBLE-SPENDING
CREATE TABLE IF NOT EXISTS member_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- RÀNG BUỘC SỐ 1: Số dư tuyệt đối không bao giờ được âm
    CONSTRAINT chk_wallet_non_negative CHECK (balance >= 0.00)
);

-- 3.8. Bảng Lịch Sử Giao Dịch Ví (Wallet Transactions)
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES member_wallets(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    transaction_type wallet_tx_type_enum NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    balance_before DECIMAL(15, 2) NOT NULL,
    balance_after DECIMAL(15, 2) NOT NULL,
    idempotency_key VARCHAR(100) UNIQUE NOT NULL, -- Chặn duplicate charge
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3.9. Bảng Giao Dịch Cổng Thanh Toán (Payments - VNPAY / MoMo / ZaloPay)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    gateway VARCHAR(50) NOT NULL,
    transaction_code VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    payment_status payment_status_enum NOT NULL DEFAULT 'PENDING',
    gateway_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3.10. Bảng Sổ Quỹ Tiền Mặt (Cash Book Logs - Luồng Walk-in & Two-Man Rule)
CREATE TABLE IF NOT EXISTS cash_book_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- Lễ tân thu/chi
    approved_by_supervisor_id UUID REFERENCES users(id) ON DELETE RESTRICT, -- Quản lý ca trực duyệt OTP
    entry_type cash_entry_type_enum NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    notes TEXT,
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3.11. Bảng Sự Kiện Đẩy Bất Đồng Bộ (Transactional Outbox Events)
-- Đảm bảo 100% không thất lạc tin nhắn/mã QR khi ứng dụng sập trước khi gửi vào Message Queue
CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(50) NOT NULL, -- 'BOOKING', 'WALLET', 'PAYMENT'
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,    -- 'BOOKING_CONFIRMED', 'AUTO_REFUND_TRIGGERED'
    payload JSONB NOT NULL,
    status outbox_status_enum NOT NULL DEFAULT 'PENDING',
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ
);

-- 3.12. Bảng Kiểm Toán Nhật Ký Hệ Thống (Audit Logs)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    entity_name VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 4. KHỞI TẠO CÁC CHỈ MỤC HIỆU NĂNG & RÀNG BUỘC ĐỘC QUYỀN (INDEXES)
-- ==============================================================================

-- 4.1. [CỰC KỲ QUAN TRỌNG] PARTIAL UNIQUE INDEX - CHỐNG DOUBLE-BOOKING CẤP CSDL
-- Đảm bảo 1 slot chỉ có duy nhất 1 booking đang hoạt động.
-- Chỉ khi booking bị hủy (CANCELLED, CANCELLED_NO_REFUND) hoặc hết hạn (EXPIRED, EXPIRED_REFUNDED),
-- slot đó mới cho phép một bản ghi booking mới được tạo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_meeting_slot 
ON bookings (slot_id) 
WHERE booking_status NOT IN ('CANCELLED', 'CANCELLED_NO_REFUND', 'EXPIRED', 'EXPIRED_REFUNDED');

-- 4.2. Chỉ mục tối ưu tra cứu phòng trống thời gian thực (Room & Slot Search)
CREATE INDEX IF NOT EXISTS idx_slots_room_availability 
ON slots (room_id, start_time, end_time, status);

-- 4.3. Chỉ mục cho Transactional Outbox Relay Worker (Quét các event chờ gửi RabbitMQ)
CREATE INDEX IF NOT EXISTS idx_outbox_events_pending 
ON outbox_events (created_at ASC) 
WHERE status = 'PENDING';

-- 4.4. Chỉ mục đối soát sổ quỹ tiền mặt theo ca trực
CREATE INDEX IF NOT EXISTS idx_cash_book_shift 
ON cash_book_logs (shift_date, admin_user_id);

-- 4.5. Chỉ mục truy vấn lịch sử giao dịch ví người dùng
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user 
ON wallet_transactions (wallet_id, created_at DESC);

-- 4.6. Chỉ mục tra cứu đơn đặt phòng theo mã code & người dùng
CREATE INDEX IF NOT EXISTS idx_bookings_user 
ON bookings (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_code 
ON bookings (booking_code);

-- ==============================================================================
-- 5. TRIGGER TỰ ĐỘNG CẬP NHẬT THỜI GIAN (UPDATED_AT TRIGGERS)
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_companies_updated_at ON companies;
CREATE TRIGGER trg_companies_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON bookings;
CREATE TRIGGER trg_bookings_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_member_wallets_updated_at ON member_wallets;
CREATE TRIGGER trg_member_wallets_updated_at
BEFORE UPDATE ON member_wallets
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- 6. HÀM NGHIỆP VỤ BẢO VỆ CONCURRENCY VÍ (HELPER STORED FUNCTION)
-- ==============================================================================
-- Hàm trừ tiền ví sử dụng Pessimistic Locking (SELECT ... FOR UPDATE)
CREATE OR REPLACE FUNCTION deduct_member_wallet(
    p_user_id UUID,
    p_amount DECIMAL,
    p_booking_id UUID,
    p_idempotency_key VARCHAR,
    p_description TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    new_balance DECIMAL,
    error_message TEXT
) AS $$
DECLARE
    v_wallet_id UUID;
    v_current_balance DECIMAL;
    v_is_frozen BOOLEAN;
BEGIN
    -- 1. Kiểm tra idempotency_key đã tồn tại chưa
    IF EXISTS (SELECT 1 FROM wallet_transactions WHERE idempotency_key = p_idempotency_key) THEN
        SELECT balance_after INTO v_current_balance 
        FROM wallet_transactions 
        WHERE idempotency_key = p_idempotency_key;
        
        RETURN QUERY SELECT TRUE, v_current_balance, 'IDEMPOTENT_SUCCESS'::TEXT;
        RETURN;
    END IF;

    -- 2. Khóa dòng dữ liệu ví bằng FOR UPDATE để chống Race Condition
    SELECT id, balance, is_frozen 
    INTO v_wallet_id, v_current_balance, v_is_frozen
    FROM member_wallets 
    WHERE user_id = p_user_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0.00, 'WALLET_NOT_FOUND'::TEXT;
        RETURN;
    END IF;

    IF v_is_frozen THEN
        RETURN QUERY SELECT FALSE, v_current_balance, 'WALLET_FROZEN'::TEXT;
        RETURN;
    END IF;

    -- 3. Kiểm tra số dư khả dụng
    IF v_current_balance < p_amount THEN
        RETURN QUERY SELECT FALSE, v_current_balance, 'INSUFFICIENT_FUNDS'::TEXT;
        RETURN;
    END IF;

    -- 4. Thực hiện trừ tiền
    UPDATE member_wallets 
    SET balance = balance - p_amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_wallet_id;

    -- 5. Ghi nhật ký giao dịch
    INSERT INTO wallet_transactions (
        wallet_id, booking_id, transaction_type, amount, 
        balance_before, balance_after, idempotency_key, description
    ) VALUES (
        v_wallet_id, p_booking_id, 'DEBIT_BOOKING', p_amount, 
        v_current_balance, v_current_balance - p_amount, p_idempotency_key, p_description
    );

    RETURN QUERY SELECT TRUE, (v_current_balance - p_amount), 'SUCCESS'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 7. DỮ LIỆU KHỞI TẠO MẪU (SEED DATA CHO KIỂM THỬ SPRINT 1)
-- ==============================================================================
-- 7.1. Chi nhánh & Phòng họp mẫu
INSERT INTO branches (id, name, address, phone)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Chi Nhánh Quận 1 - Tòa Nhà Landmark', 'Số 1 Nguyễn Thị Minh Khai, Q1, TP.HCM', '02838123456')
ON CONFLICT (id) DO NOTHING;

INSERT INTO rooms (id, branch_id, name, room_type, capacity, hourly_rate, amenities)
VALUES 
    ('r0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Meeting Room Alpha', 'STANDARD', 8, 350000.00, '{"projector": true, "whiteboard": true}'::JSONB),
    ('r0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Executive Boardroom Tokyo', 'EXECUTIVE', 20, 800000.00, '{"projector": true, "whiteboard": true, "video_conf": true}'::JSONB)
ON CONFLICT (id) DO NOTHING;

-- 7.2. Doanh nghiệp mẫu có hạn mức công nợ
INSERT INTO companies (id, name, tax_code, credit_limit, current_debt)
VALUES ('c0000000-0000-0000-0000-000000000001', 'Tập Đoàn Công Nghệ Global Corp', '0312345678', 20000000.00, 5000000.00)
ON CONFLICT (id) DO NOTHING;

-- 7.3. Tài khoản Người dùng & Ví mẫu
INSERT INTO users (id, company_id, email, phone, full_name, password_hash, role)
VALUES 
    ('u0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'admin@smartbooking.local', '+84900000001', 'He Thong Quan Tri', crypt('Admin@123', gen_salt('bf')), 'ADMIN'),
    ('u0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'supervisor@smartbooking.local', '+84900000002', 'Quản Lý Ca Truc', crypt('Supervisor@123', gen_salt('bf')), 'STAFF'),
    ('u0000000-0000-0000-0000-000000000003', NULL, 'member@smartbooking.local', '+84900000003', 'Thành Viên Vip', crypt('Member@123', gen_salt('bf')), 'MEMBER')
ON CONFLICT (id) DO NOTHING;

-- Khởi tạo ví mẫu 1.000.000 VND cho Thành viên VIP
INSERT INTO member_wallets (id, user_id, balance, currency)
VALUES ('w0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000003', 1000000.00, 'VND')
ON CONFLICT (user_id) DO NOTHING;
