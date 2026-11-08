-- ==============================================================================
-- DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
-- DATABASE SCHEMA MIGRATION: v1.5 (Corporate Quota & Advanced Reconciliation)
-- FILE: src/database/schema_v1.5_corporate_quota.sql
-- MÔ TẢ: Bổ sung kiến trúc Quản lý Doanh nghiệp & Thành viên (B2B Quota)
--       và Đối soát Kế toán theo chuẩn BA/SA v1.5:
--       1. Mở rộng companies: thông tin liên hệ, hợp đồng, chính sách giá
--       2. Kiểu ENUM mới: quota_type_enum, reset_cycle_enum, quota_tx_enum
--       3. Thêm giá trị 'CORPORATE_QUOTA' vào payment_method_enum
--       4. Thêm giá trị 'ACCOUNTANT' vào user_role_enum
--       5. Bảng member_quotas: quản lý hạn mức từng thành viên (CREDIT / BOOKINGS / HOURS)
--       6. Bảng quota_ledger: sổ cái tiêu hao & hoàn trả hạn mức bất biến
--       7. Bổ sung bookings: actual_check_in, actual_check_out, quota_consumed
--       8. Chỉ mục tối ưu truy vấn đối soát kế toán theo khoảng ngày
-- ==============================================================================

-- 1. CẬP NHẬT KIỂU DỮ LIỆU ENUM
DO $$ BEGIN
    CREATE TYPE quota_type_enum AS ENUM ('CREDIT', 'BOOKINGS', 'HOURS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reset_cycle_enum AS ENUM ('WEEKLY', 'MONTHLY', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE quota_tx_enum AS ENUM ('CONSUME', 'RELEASE', 'ADJUST', 'RESET', 'OVERTIME');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE payment_method_enum ADD VALUE IF NOT EXISTS 'CORPORATE_QUOTA';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'ACCOUNTANT';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. MỞ RỘNG BẢNG DOANH NGHIỆP (COMPANIES)
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS contact_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20),
    ADD COLUMN IF NOT EXISTS billing_address TEXT,
    ADD COLUMN IF NOT EXISTS pricing_policy_id UUID,
    ADD COLUMN IF NOT EXISTS contract_no VARCHAR(50),
    ADD COLUMN IF NOT EXISTS contract_start DATE,
    ADD COLUMN IF NOT EXISTS contract_end DATE;

-- 3. BẢNG HẠN MỨC THÀNH VIÊN DOANH NGHIỆP (MEMBER_QUOTAS)
CREATE TABLE IF NOT EXISTS member_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    quota_type quota_type_enum NOT NULL,
    quota_limit DECIMAL(15, 2) NOT NULL CHECK (quota_limit >= 0.00),
    quota_used DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (quota_used >= 0.00),
    reset_cycle reset_cycle_enum NOT NULL DEFAULT 'MONTHLY',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_quota_not_exceeded CHECK (quota_used <= quota_limit),
    CONSTRAINT uq_member_quota UNIQUE (user_id, quota_type)
);

-- 4. BẢNG SỔ CÁI HẠN MỨC BẤT BIẾN (QUOTA_LEDGER)
CREATE TABLE IF NOT EXISTS quota_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_quota_id UUID NOT NULL REFERENCES member_quotas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    tx_type quota_tx_enum NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    used_before DECIMAL(15, 2) NOT NULL,
    used_after DECIMAL(15, 2) NOT NULL,
    period_start DATE NOT NULL,
    reason TEXT,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. BỔ SUNG TRƯỜNG CHO BẢNG BOOKINGS
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS actual_check_in TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS actual_check_out TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS quota_consumed JSONB;

-- 6. CHỈ MỤC TỐI ƯU HIỆU NĂNG CHO BÁO CÁO & ĐỐI SOÁT
CREATE INDEX IF NOT EXISTS idx_quota_ledger_user_time 
ON quota_ledger (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quota_ledger_company_time 
ON quota_ledger (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_quotas_lookup 
ON member_quotas (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_bookings_created_at 
ON bookings (created_at);

CREATE INDEX IF NOT EXISTS idx_payments_created_at 
ON payments (created_at);

CREATE INDEX IF NOT EXISTS idx_cash_book_created_at 
ON cash_book_logs (created_at);

-- 7. TRIGGER CẬP NHẬT UPDATED_AT CHO MEMBER_QUOTAS
DROP TRIGGER IF EXISTS trg_member_quotas_updated_at ON member_quotas;
CREATE TRIGGER trg_member_quotas_updated_at
BEFORE UPDATE ON member_quotas
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

