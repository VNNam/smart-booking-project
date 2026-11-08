-- ==============================================================================
-- DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
-- SEED DATA: v1.4 UAT Initial Accounts & Catalog
-- FILE: src/database/seed_v1.sql
-- ==============================================================================

-- 1. TẠO CHI NHÁNH TÒA NHÀ MẪU
INSERT INTO branches (id, name, address, phone, is_active)
VALUES 
    ('b1111111-1111-1111-1111-111111111111', 'Chi nhánh Hội sở Landmark 81', '720A Điện Biên Phủ, Phường 22, Bình Thạnh, TP.HCM', '02812345678', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2. TẠO DOANH NGHIỆP CÔNG NỢ MẪU
INSERT INTO companies (id, name, tax_code, credit_limit, current_debt, is_active)
VALUES 
    ('c1111111-1111-1111-1111-111111111111', 'Tập đoàn Công nghệ FPT', '0101234567', 50000000.00, 15000000.00, TRUE),
    ('c2222222-2222-2222-2222-222222222222', 'Tổng công ty Viễn thông Viettel', '0108889999', 30000000.00, 24500000.00, TRUE)
ON CONFLICT (tax_code) DO NOTHING;

-- 3. TẠO 4 TÀI KHOẢN VAI TRÒ NÒNG CỐT ĐỂ TEST UAT
-- Mật khẩu Admin: Admin@123456
-- Mật khẩu Lễ tân: Staff@123456
-- Mật khẩu Kế toán: Accountant@123456
-- Mật khẩu Member: Member@123456

INSERT INTO users (id, email, phone, full_name, password_hash, role, credit_limit, current_debt, is_active)
VALUES 
    (
        'u1111111-1111-1111-1111-111111111111',
        'admin@smartbooking.vn',
        '0909000001',
        'Quản Trị Viên Hệ Thống',
        '51c674294513f2180cbcd6d7d8de43f1:75ba7099ba063bb9fa984b545183313881e2f82ccb9c1df586718e12258de1d19c73f0f9829d9569daf893373e46a983cfc1a20374ffe7ab22df4e4fa48b8d34',
        'ADMIN',
        0.00, 0.00, TRUE
    ),
    (
        'u2222222-2222-2222-2222-222222222222',
        'receptionist@smartbooking.vn',
        '0909000002',
        'Lễ Tân Ca Trực',
        'de1a7e8a824cf0a2c5166d981c1251cf:4242f59e7578a203658a8adcacfea3e3a9fc9b683abfba3ffefd8b52888a29da957edcd73505dda23dd1741a7bf75d7b73ab834d59cd6af001bd46520d823a50',
        'STAFF',
        0.00, 0.00, TRUE
    ),
    (
        'u3333333-3333-3333-3333-333333333333',
        'accountant@smartbooking.vn',
        '0909000003',
        'Kế Toán Sổ Quỹ',
        '5080c505dfb267004be82004e2f241c6:cddc08b821f6c2763c55f91654c71e0fda0a256775071844d82663b78ab0afd0885c1a1a3c3d3af6c153c09ab36a12749796cea9bcdde3deb8ac0410ac6b9e94',
        'STAFF',
        0.00, 0.00, TRUE
    ),
    (
        'u4444444-4444-4444-4444-444444444444',
        'member@smartbooking.vn',
        '0901234567',
        'Nguyễn Văn Hội Viên',
        '7d407163761e2778ed457ce73744943c:abe1a94a77587366dc1d41d9730efba79986bd7b0c71d3be6cfdcfabeb891a28ab7de9087ba5c61998d3c98a3afb56756371467702b7232a063727ef865f5b17',
        'MEMBER',
        0.00, 0.00, TRUE
    )
ON CONFLICT (email) DO NOTHING;

-- 4. TẠO VÍ HỘI VIÊN VỚI SỐ DƯ BAN ĐẦU 5,000,000 VND
INSERT INTO member_wallets (id, user_id, balance)
VALUES ('w4444444-4444-4444-4444-444444444444', 'u4444444-4444-4444-4444-444444444444', 5000000.00)
ON CONFLICT (user_id) DO UPDATE SET balance = 5000000.00;

-- 5. TẠO CÁC PHÒNG HỌP MẪU
INSERT INTO rooms (id, branch_id, name, room_type, capacity, hourly_rate, amenities, is_active)
VALUES 
    (
        'r1111111-1111-1111-1111-111111111111',
        'b1111111-1111-1111-1111-111111111111',
        'Meeting Room Alpha',
        'STANDARD',
        8,
        350000.00,
        '{"projector": true, "whiteboard": true, "videoConf": false, "highSpeedWifi": true}'::jsonb,
        TRUE
    ),
    (
        'r2222222-2222-2222-2222-222222222222',
        'b1111111-1111-1111-1111-111111111111',
        'Executive Room Tokyo',
        'EXECUTIVE',
        16,
        650000.00,
        '{"projector": true, "whiteboard": true, "videoConf": true, "soundSystem": true, "highSpeedWifi": true}'::jsonb,
        TRUE
    ),
    (
        'r3333333-3333-3333-3333-333333333333',
        'b1111111-1111-1111-1111-111111111111',
        'Boardroom New York',
        'BOARDROOM',
        24,
        1200000.00,
        '{"projector": true, "whiteboard": true, "videoConf": true, "soundSystem": true, "smartTv": true, "highSpeedWifi": true}'::jsonb,
        TRUE
    )
ON CONFLICT (id) DO NOTHING;
