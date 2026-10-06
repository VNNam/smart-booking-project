# Project Roadmap & Milestones

**Dự án:** Smart Meeting Room Booking System  
**Quản lý bởi:** @PM_Agent  
**Cập nhật lần cuối:** 2026-10-06  

---

## 1. Biểu đồ Kế hoạch Tổng thể (Mermaid Gantt Chart)

```mermaid
gantt
    title Lộ trình Phát triển Smart Booking Platform (2026 - Hardened v1.4)
    dateFormat  YYYY-MM-DD
    section Giai đoạn 1: Kiến trúc v1.4
    Đặc tả yêu cầu & BRD v1.4       :done,    des1, 2026-10-01, 2026-10-05
    Thiết kế CSDL & API Contracts v1.4 :done, des2, 2026-10-05, 2026-10-06
    
    section Giai đoạn 2: Sprint 1 (Core Engine)
    Schema DB, Pessimistic Lock, Idempotency :done, sp1, 2026-10-05, 2026-10-06
    
    section Giai đoạn 3: Sprint 2 (Payment & Saga)
    BookingService & Late Webhook Auto-Refund :done, sp2, 2026-10-06, 2026-10-06

    section Giai đoạn 3.1: Sprint 3 (Web Admin Walk-in)
    Walk-in Cash Booking & Two-Man Rule Modal :done, sp3, 2026-10-06, 2026-10-06
    
    section Giai đoạn 3.5: Sprint 3.5 (Frontend Apps)
    Web Admin Grid & Corporate Debt UI :done, sp35_1, 2026-10-06, 2026-10-06
    Mobile App Search, 10m Timer & QR Check-in :done, sp35_2, 2026-10-06, 2026-10-06
    
    section Giai đoạn 4: UAT & Launch
    UAT Deployment & Test Playbook ($0) :active,  uat1,  2026-10-07, 2026-10-15
    Triển khai Production (MVP)         :crit,    prod,  2026-10-25, 2026-10-26
```

---

## 2. Các Cột mốc Quan trọng (Key Milestones)

| Cột mốc | Tên Milestone | Mục tiêu cần đạt | Hạn chót dự kiến | Trạng thái |
|---|---|---|---|---|
| **M1** | Architecture Freeze v1.4 | Hoàn thiện ERD, API specs v1.4, Two-Man Rule, Credit Limit, Outbox | 2026-10-05 | **COMPLETED** |
| **M2** | Core Booking Engine (Sprint 1) | Đặt chỗ không trùng lặp, cơ chế Redis Redlock, Pessimistic lock, QA locks test | 2026-10-06 | **COMPLETED** |
| **M3** | Payment & Saga Webhook (Sprint 2) | Hoàn tất tích hợp 4 cổng thanh toán, Late Webhook Saga Auto-Refund | 2026-10-06 | **COMPLETED** |
| **M4** | Web Admin Cash Walk-in (Sprint 3) | Walk-in Cash UI, OTP Quản lý ca trực duyệt hoàn tiền mặt, Cypress E2E | 2026-10-06 | **COMPLETED** |
| **M4.5** | **Frontend Client Apps (Sprint 3.5)** | **Hoàn thiện Mobile App (Expo) & Web Admin Grid/Debt UI trước khi UAT** | **2026-10-06** | **COMPLETED** |
| **M5** | **UAT Deployment & Testing (Stage 4)** | **Triển khai hạ tầng UAT $0 Free-Tier (Vercel, Render, Neon, Upstash) & Thực thi Kịch bản UAT** | **2026-10-15** | **ACTIVE (PLAYBOOK & DEPLOY READY)** |
| **M6** | Production Go-Live | Triển khai chính thức Production và bàn giao hệ thống | 2026-10-26 | **PENDING UAT SIGN-OFF** |


