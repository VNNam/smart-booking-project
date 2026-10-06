# Database Entity-Relationship Diagram (ERD)
**Project:** Smart Meeting Room Booking System  
**BRD Version Alignment:** v1.4 (Post-Audit Hardened)  
**Database Engine:** PostgreSQL 16  
**Last Updated:** 2026-10-05  

---

## 1. Sơ đồ Mermaid ER Diagram (Cập nhật v1.4)

```mermaid
erDiagram
    COMPANIES ||--o{ USERS : "employs"
    USERS ||--o{ BOOKINGS : "places"
    USERS ||--o| MEMBER_WALLETS : "owns"
    USERS ||--o{ CASH_BOOK_LOGS : "processed_by_admin"
    USERS ||--o{ CASH_BOOK_LOGS : "approved_by_supervisor"
    USERS ||--o{ AUDIT_LOGS : "triggers"
    
    BRANCHES ||--|{ ROOMS : "contains"
    ROOMS ||--o{ SLOTS : "schedules"
    
    BOOKINGS ||--|| SLOTS : "reserves"
    BOOKINGS ||--|| ROOMS : "targets"
    BOOKINGS ||--o{ PAYMENTS : "generates"
    BOOKINGS ||--o| CASH_BOOK_LOGS : "logs_cash_entry"
    BOOKINGS ||--o{ OUTBOX_EVENTS : "triggers_event"
    
    MEMBER_WALLETS ||--o{ WALLET_TRANSACTIONS : "records"
    BOOKINGS ||--o{ WALLET_TRANSACTIONS : "settles_via"

    COMPANIES {
        uuid id PK
        varchar name
        varchar tax_code UK
        decimal credit_limit "Hạn mức nợ tối đa"
        decimal current_debt "Nợ lũy kế hiện tại"
        boolean is_active
        timestamp created_at
    }

    USERS {
        uuid id PK
        uuid company_id FK "nullable"
        varchar email UK
        varchar phone UK
        varchar full_name
        varchar role "CUSTOMER | MEMBER | STAFF | ADMIN"
        decimal credit_limit "Dành cho VIP cá nhân"
        decimal current_debt "Dư nợ hiện tại"
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    BRANCHES {
        uuid id PK
        varchar name
        varchar address
        varchar phone
        boolean is_active
    }

    ROOMS {
        uuid id PK
        uuid branch_id FK
        varchar name
        varchar room_type "STANDARD | EXECUTIVE | BOARDROOM"
        int capacity
        decimal hourly_rate
        jsonb amenities "projector, whiteboard, video_conf"
        boolean is_active
    }

    SLOTS {
        uuid id PK
        uuid room_id FK
        timestamp start_time
        timestamp end_time
        varchar status "AVAILABLE | LOCKED | BOOKED | MAINTENANCE"
        timestamp lock_expires_at
    }

    BOOKINGS {
        uuid id PK
        uuid user_id FK
        uuid room_id FK
        uuid slot_id FK UK
        varchar booking_code UK
        varchar booking_status "LOCKED_PENDING_ONLINE | CONFIRMED | CONFIRMED_PAID | CONFIRMED_DEBT | CANCELLED | CANCELLED_NO_REFUND | EXPIRED"
        varchar payment_method "ONLINE_GATEWAY | PREPAID_WALLET | CASH_ON_ARRIVAL | POSTPAID_DEBT"
        varchar payment_status "PENDING | PAID | REFUNDED | UNPAID"
        varchar booking_channel "MOBILE_APP | WEB_ADMIN"
        decimal total_amount
        decimal refund_amount
        varchar corporate_debt_account "nullable"
        uuid supervisor_otp_approved_by FK "nullable"
        text notes
        timestamp lock_expires_at "TTL 10 mins (600s)"
        timestamp created_at
        timestamp updated_at
    }

    MEMBER_WALLETS {
        uuid id PK
        uuid user_id FK UK
        decimal balance "Default 0.00 (CHECK balance >= 0)"
        varchar currency "VND"
        boolean is_frozen
        timestamp updated_at
    }

    WALLET_TRANSACTIONS {
        uuid id PK
        uuid wallet_id FK
        uuid booking_id FK "nullable"
        varchar transaction_type "TOPUP | DEBIT_BOOKING | REFUND"
        decimal amount
        decimal balance_before
        decimal balance_after
        varchar idempotency_key UK
        text description
        timestamp created_at
    }

    PAYMENTS {
        uuid id PK
        uuid booking_id FK
        varchar gateway "VNPAY | MOMO | ZALOPAY"
        varchar transaction_code UK
        decimal amount
        varchar currency "VND"
        varchar payment_status "PENDING | SUCCESS | FAILED | REFUNDED"
        jsonb gateway_response
        timestamp created_at
    }

    CASH_BOOK_LOGS {
        uuid id PK
        uuid booking_id FK
        uuid admin_user_id FK "Lễ tân thao tác"
        uuid approved_by_supervisor_id FK "Quản lý duyệt OTP"
        varchar entry_type "CASH_IN_COLLECT | CASH_OUT_REFUND"
        decimal amount
        text notes
        date shift_date
        timestamp created_at
    }

    OUTBOX_EVENTS {
        uuid id PK
        varchar aggregate_type "BOOKING | WALLET"
        uuid aggregate_id
        varchar event_type "BOOKING_CONFIRMED | REFUND_REQUESTED | QR_GENERATED"
        jsonb payload
        varchar status "PENDING | PROCESSED | FAILED"
        int retry_count
        timestamp created_at
        timestamp processed_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid user_id FK
        varchar entity_name
        uuid entity_id
        varchar action "INSERT | UPDATE | CANCEL | REFUND"
        jsonb old_values
        jsonb new_values
        timestamp created_at
    }
```

---

## 2. Các Ràng buộc & Chỉ mục Hiệu năng Cốt lõi (Constraints & DDL v1.4)

### 2.1. Bảo vệ Toàn vẹn Dữ liệu Ví Thành viên (Anti Double-Spending)
Bắt buộc áp dụng cơ chế khóa dòng Pessimistic Locking và Constraint chặn số dư âm:
```sql
-- Ràng buộc không bao giờ cho phép số dư âm
ALTER TABLE member_wallets 
ADD CONSTRAINT chk_wallet_non_negative CHECK (balance >= 0);

-- Mẫu câu lệnh trừ tiền bắt buộc dùng trong Backend:
BEGIN;
SELECT balance FROM member_wallets WHERE user_id = $1 FOR UPDATE;
-- Nếu balance >= room_price:
UPDATE member_wallets SET balance = balance - $2 WHERE user_id = $1;
INSERT INTO wallet_transactions (wallet_id, booking_id, transaction_type, amount, balance_before, balance_after, idempotency_key)
VALUES ($3, $4, 'DEBIT_BOOKING', $2, $5, $5 - $2, $6);
COMMIT;
```

### 2.2. Kiểm soát Hạn mức Tín dụng Công nợ (Credit Limit Enforcement)
```sql
-- Kiểm tra hạn mức công nợ doanh nghiệp
ALTER TABLE companies 
ADD CONSTRAINT chk_company_credit_limit CHECK (current_debt <= credit_limit);
```

### 2.3. Ngăn chặn Double-Booking ở tầng CSDL
```sql
CREATE UNIQUE INDEX idx_unique_active_meeting_slot 
ON bookings (slot_id) 
WHERE booking_status NOT IN ('CANCELLED', 'CANCELLED_NO_REFUND', 'EXPIRED');
```

### 2.4. Chỉ mục Hiệu năng cho Transactional Outbox Worker
```sql
-- Hỗ trợ Outbox Relay Worker quét nhanh các event chưa xử lý theo thứ tự thời gian
CREATE INDEX idx_outbox_events_pending 
ON outbox_events (created_at ASC) 
WHERE status = 'PENDING';
```
