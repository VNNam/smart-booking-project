# 📜 NHẬT KÝ MASTER PROMPT DỰ ÁN (PROJECT MASTER PROMPT LOG)

**Dự án:** Smart Meeting Room Booking System  
**Phiên bản:** v1.4 Hardened  
**Biên soạn bởi:** `@PM_Agent` (Supreme Orchestrator)  
**Mục đích:** Lưu trữ toàn bộ các lệnh điều phối (`# [SYSTEM COMMAND]`, `[SYSTEM RESUME]`) đã được sử dụng trong suốt vòng đời dự án nhằm xây dựng khung mẫu (framework) tái sử dụng cho các dự án phát triển phần mềm tự trị trong tương lai.  

---

## 📑 MỤC LỤC & TỔNG QUAN CÁC GIAI ĐOẠN

| STT | Giai đoạn (Phase) | Tên Lệnh / Prompt Master | Vai trò chính |
|:---:|---|---|---|
| **01** | Phase 1: Project Initialization & Workspace Setup | [Workspace Structure & Directory Initialization](#prompt-01) | Khởi tạo / Điều phối |
| **02** | Phase 1: Project Initialization & Synchronization | [# \[SYSTEM COMMAND\]: TRIGGER FULL PROJECT SYNC & GENERATION](#prompt-02) | Khởi tạo / Điều phối |
| **03** | Phase 2: Architecture Audit & Gap Analysis | [# \[SYSTEM COMMAND\]: TRIGGER SYSTEM AUDIT & GAP ANALYSIS](#prompt-03) | Khởi tạo / Điều phối |
| **04** | Phase 2: Architecture Audit & Hardening (v1.3 to v1.4) | [# \[SYSTEM COMMAND\]: IMPLEMENT ARCHITECTURE & REQUIREMENT UPDATES (POST-AUDIT)](#prompt-04) | Khởi tạo / Điều phối |
| **05** | Phase 3: Continuous Agile Development & State Management | [# \[SYSTEM COMMAND\]: CONTINUOUS AGILE DEVELOPMENT & STATE MANAGEMENT](#prompt-05) | Khởi tạo / Điều phối |
| **06** | Phase 3: Continuous Agile Development & State Management | [\[SYSTEM RESUME\]: Proceed to the next pending task (Task 1.2)](#prompt-06) | Khởi tạo / Điều phối |
| **07** | Phase 3: Continuous Agile Development & State Management | [\[SYSTEM RESUME\]: Proceed to the next pending task (Task 1.3)](#prompt-07) | Khởi tạo / Điều phối |
| **08** | Phase 4: Token Diagnostics, Context Compression & Session Continuity | [# \[SYSTEM COMMAND\]: CONTEXT WINDOW & TOKEN USAGE DIAGNOSTIC](#prompt-08) | Khởi tạo / Điều phối |
| **09** | Phase 4: Token Diagnostics, Context Compression & Session Continuity | [SAVE CONTEXT COMPRESSION SUMMARY & \[SYSTEM RESUME\] (Task 2.1)](#prompt-09) | Khởi tạo / Điều phối |
| **10** | Phase 4: Token Diagnostics, Context Compression & Session Continuity | [\[SYSTEM RESUME\]: Proceed to the next pending task (Task 2.2)](#prompt-10) | Khởi tạo / Điều phối |
| **11** | Phase 4: Token Diagnostics, Context Compression & Session Continuity | [\[SYSTEM RESUME\]: Proceed to the next pending task (Task 2.3)](#prompt-11) | Khởi tạo / Điều phối |
| **12** | Phase 4: Token Diagnostics, Context Compression & Session Continuity | [# \[SYSTEM COMMAND\]: CONTEXT DIAGNOSTIC & AUTO-RESUME PIPELINE](#prompt-12) | Khởi tạo / Điều phối |
| **13** | Phase 5: Integrity Auditing, Reporting & Scope Expansion | [# \[SYSTEM COMMAND\]: WORKSPACE INTEGRITY AUDIT & FILE RECOVERY](#prompt-13) | Khởi tạo / Điều phối |
| **14** | Phase 5: Integrity Auditing, Reporting & Scope Expansion | [# \[SYSTEM COMMAND\]: COMPREHENSIVE PROJECT PROGRESS & STATUS REPORT](#prompt-14) | Khởi tạo / Điều phối |
| **15** | Phase 5: Integrity Auditing, Reporting & Scope Expansion | [# \[SYSTEM COMMAND\]: FRONTEND GAP ANALYSIS & DEVELOPMENT PLANNING](#prompt-15) | Khởi tạo / Điều phối |
| **16** | Phase 6: Full Autonomous Execution & Codebase Completion | [# \[SYSTEM COMMAND\]: FULL AUTONOMOUS EXECUTION & TOKEN DIAGNOSTIC PIPELINE](#prompt-16) | Khởi tạo / Điều phối |
| **17** | Phase 7: Zero-Cost UAT Deployment & Testing Strategy | [# \[SYSTEM COMMAND\]: ZERO-COST UAT DEPLOYMENT & TESTING STRATEGY](#prompt-17) | Khởi tạo / Điều phối |
| **18** | Phase 8: Project Prompt Logging & Knowledge Preservation | [# \[SYSTEM COMMAND\]: COMPILE AND EXPORT PROJECT PROMPT LOG](#prompt-18) | Khởi tạo / Điều phối |

---

## 🏛️ Phase 1: Project Initialization & Workspace Setup

### <a id="prompt-01"></a>01. Workspace Structure & Directory Initialization

- **Bước thực thi trong phiên (Step Index):** Step 0
- **Giai đoạn/Ngữ cảnh (Phase/Context):** Used at the very beginning of the project to initialize the complete directory structure and preliminary file layout for the Smart Meeting Room Booking System.
- **Nội dung Master Prompt (Prompt Content):**

````markdown
@workspace Hãy tạo cấu trúc dự án theo nội dung sau "/smart-booking-project
│
├── /01-requirements          # Chứa các yêu cầu kinh doanh và đặc tả
│   ├── brd_v1.3.md           # Business Requirements Document (đã làm ở trên)
│   ├── user_stories.md       # Danh sách chi tiết các chức năng (Agile Backlog)
│   └── acceptance_criteria/  # Các tiêu chí chấp nhận chi tiết cho từng luồng
│
├── /02-architecture          # Chứa các bản thiết kế kỹ thuật
│   ├── system_design.md      # Thiết kế hệ thống tổng quan
│   ├── database_erd.md       # Thiết kế CSDL (Dùng Mermaid ER Diagram)
│   └── api_contracts/        # Các file Swagger/OpenAPI (YAML hoặc JSON)
│
├── /03-project-management    # TRUNG TÂM HOẠT ĐỘNG CỦA PM AGENT
│   ├── roadmap.md            # Kế hoạch tổng thể (Gantt chart/Milestones)
│   ├── sprint_logs/          # Lưu trữ tiến độ từng Sprint (Mỗi Sprint 1 file)
│   │   ├── sprint_1_log.md
│   │   └── sprint_2_log.md
│   ├── issue_tracker.md      # Danh sách các vấn đề/rủi ro đang bị block
│   └── meeting_minutes/      # Biên bản họp định dạng Markdown (để Agent tóm tắt)
│
├── /04-testing               # Kịch bản kiểm thử tự động
│   └── bdd_features/         # Các file Gherkin (.feature)
│       ├── online_payment.feature
│       └── cancellation.feature
│
└── project_context.yaml      # FILE QUAN TRỌNG NHẤT: Bối cảnh dự án cho Agent"
````

---

## 🏛️ Phase 1: Project Initialization & Synchronization

### <a id="prompt-02"></a>02. # [SYSTEM COMMAND]: TRIGGER FULL PROJECT SYNC & GENERATION

- **Bước thực thi trong phiên (Step Index):** Step 42
- **Giai đoạn/Ngữ cảnh (Phase/Context):** Used after updating the core Business Requirements Document (brd_v1.3.md) to orchestrate the AI agent crew in synchronizing all architecture documents, OpenAPI specs, and BDD test scenarios.
- **Nội dung Master Prompt (Prompt Content):**

````markdown
# [SYSTEM COMMAND]: TRIGGER FULL PROJECT SYNC & GENERATION
**Context:** I have just updated the core Business Requirements Document to `brd_v1.3.md` in the `/01-requirements` folder. The new version introduces complex multi-payment flows (Online, Prepaid Wallet, Cash on Arrival, Postpaid Debt) and role-based access.

**Objective:** Orchestrate the agent crew to read `brd_v1.3.md`, evaluate the changes, and automatically generate, update, or append necessary files across the project directory to reflect these new business rules.

**Execution Pipeline & Agent Tasks:**

**1. @BA_Agent (Business Analyst):**
- Read `brd_v1.3.md`.
- Update `/01-requirements/user_stories.md`: Write new User Stories focusing on the Walk-in Cash flow (Admin Web) and Prepaid Wallet flow (Mobile App). Use standard Agile format.
- Create `/01-requirements/acceptance_criteria/payment_flows.md`: Define clear conditions for state transitions (LOCKED -> CONFIRMED_PAID, etc.).

**2. @Architect_Agent (System Architect):**
- Review the BPMN Mermaid diagrams in `brd_v1.3.md`.
- Update `/02-architecture/database_erd.md`: Add a Mermaid ER diagram reflecting the new `Booking` table fields (e.g., `payment_method`, `payment_status`, `booking_status`).
- Generate `/02-architecture/api_contracts/booking_api.yaml`: Write an OpenAPI 3.0 spec for the `POST /api/v1/bookings` endpoint that handles the different payment methods based on the user's role.

**3. @QA_Agent (Test Automation):**
- Generate `/04-testing/bdd_features/cash_payment.feature`: Write Gherkin scenarios for the "Admin booking with Cash on Arrival" flow, including the cancellation rule.
- Generate `/04-testing/bdd_features/wallet_payment.feature`: Write Gherkin scenarios for the "Prepaid member booking with insufficient funds" exception path.

**4. @PM_Agent (Project Manager):**
- Review the generated artifacts.
- Update `/03-project-management/project_context.yaml`: Bump the BRD version to 1.3 and log the recent architecture changes.
- Update `/03-project-management/sprint_logs/sprint_2_log.md`: Inject new tasks for Backend (implementing the new APIs) and Frontend (Web Admin UI for Cash bookings) into the "To Do" list.

**Constraints:**
- Maintain strictly the directory hierarchy as defined in the workspace.
- Do not overwrite existing unrelated files. If a file exists, append/update only the sections affected by BRD v1.3.
- Use valid Markdown, Mermaid JS, YAML, and Gherkin syntax in the output files.
- Return a summary report of all modified and newly created files when the execution is complete.

**Execute Pipeline Now.**
````

---

## 🏛️ Phase 2: Architecture Audit & Gap Analysis

### <a id="prompt-03"></a>03. # [SYSTEM COMMAND]: TRIGGER SYSTEM AUDIT & GAP ANALYSIS

- **Bước thực thi trong phiên (Step Index):** Step 102
- **Giai đoạn/Ngữ cảnh (Phase/Context):** Used after initial design completion to conduct a critical cross-functional audit, identifying high-risk edge cases like late webhooks, wallet double-spending, and inventory hoarding.
- **Nội dung Master Prompt (Prompt Content):**

````markdown
# [SYSTEM COMMAND]: TRIGGER SYSTEM AUDIT & GAP ANALYSIS
**Context:** The project "Smart Meeting Room Booking System" has completed its initial design phase. The core requirements are in `/01-requirements/brd_v1.3.md` and the technical designs are in the `/02-architecture/` directory.

**Objective:** Orchestrate a cross-functional review by the BA and Architect agents to critically audit the current requirements and system architecture. Identify potential edge cases, bottlenecks, security risks, or scalability issues. Propose alternative approaches where applicable, and compile a comprehensive Evaluation Report.

**Execution Pipeline & Agent Tasks:**

**1. @BA_Agent (Business Analyst):**
- **Read & Analyze:** Scrutinize `/01-requirements/brd_v1.3.md` and `user_stories.md`.
- **Focus Areas:** 
  - Identify missing edge cases in the payment flows (e.g., what happens if a Walk-in Cash booking is made, but the user damages the room? Is there a deposit mechanism?).
  - Analyze the Cancellation Policy (Section 5.5) for potential abuse or refund loopholes.
  - Evaluate the user experience constraints (e.g., is 5 minutes TTL for online payment too short or too long based on industry standards?).
- **Output:** Generate a list of "Business Risks & Logic Gaps" with proposed solutions. Pass this to the PM_Agent.

**2. @Architect_Agent (System Architect):**
- **Read & Analyze:** Scrutinize `/02-architecture/database_erd.md`, `system_design.md`, and `api_contracts/booking_api.yaml`.
- **Focus Areas:**
  - *Concurrency & Race Conditions:* Evaluate the Distributed Lock mechanism using Redis. Can it truly handle 1,000 simultaneous requests at 8:00 AM without double-booking?
  - *Data Consistency:* Analyze the state transitions between the Payment Gateway and the Database. What happens if the webhook from VNPAY fails or is delayed?
  - *Security:* Are there vulnerabilities in how the Prepaid Wallet balance is deducted?
  - *Alternative Tech:* Propose alternative architectures (e.g., using Event-Driven Architecture with Kafka/RabbitMQ instead of synchronous API calls) if they offer better reliability.
- **Output:** Generate a list of "Technical Risks & Architecture Alternatives". Pass this to the PM_Agent.

**3. @PM_Agent (Project Manager & Orchestrator):**
- **Synthesize:** Receive the findings from @BA_Agent and @Architect_Agent.
- **Generate Report:** Create a new file at `/03-project-management/design_evaluation_report.md`.
- **Report Structure:**
  - Executive Summary.
  - Identified Business Gaps & Solutions.
  - Identified Technical Bottlenecks & Alternative Architectures.
  - Action Items (Go/No-Go decision for the next development phase).

**Constraints:**
- **READ-ONLY MODE for existing files:** Do NOT modify, delete, or append to any existing files in `/01-requirements` or `/02-architecture`.
- Provide highly critical, devil's-advocate perspectives. Assume the system will be targeted by malicious users and high traffic spikes.
- The final output must be solely the `/03-project-management/design_evaluation_report.md` file formatted in professional Markdown.

**Execute Pipeline Now.**
````

---

## 🏛️ Phase 2: Architecture Audit & Hardening (v1.3 to v1.4)

### <a id="prompt-04"></a>04. # [SYSTEM COMMAND]: IMPLEMENT ARCHITECTURE & REQUIREMENT UPDATES (POST-AUDIT)

- **Bước thực thi trong phiên (Step Index):** Step 108
- **Giai đoạn/Ngữ cảnh (Phase/Context):** Used following the approval of design_evaluation_report.md to implement the hardened v1.4 requirements across all architecture, ERD, API specs, and BDD test suites.
- **Nội dung Master Prompt (Prompt Content):**

````markdown
# [SYSTEM COMMAND]: IMPLEMENT ARCHITECTURE & REQUIREMENT UPDATES (POST-AUDIT)
**Context:** The `design_evaluation_report.md` has been reviewed and approved with a "CONDITIONAL GO" status. We must address critical architectural flaws (Race conditions, Late Webhooks, Lack of Outbox Pattern) and business loopholes (Fraudulent cash refunds, inventory hoarding) before coding begins.

**Objective:** Orchestrate the agent crew to update all relevant specification files (`brd_v1.3.md` -> `brd_v1.4.md`, ERDs, API Contracts, and test features) based ONLY on the "Mandatory Action Items" listed in the audit report. 

**Execution Pipeline & Agent Tasks:**

**1. @BA_Agent (Business Requirements Refinement):**
- Update `/01-requirements/brd_v1.3.md` (Rename internally to `brd_v1.4.md`):
    - Change the "Online Payment Lock TTL" from 5 minutes to 10 minutes.
    - Rewrite the "Cancellation Policy" to include multi-tiered penalties (100% refund for >24h, 80% for 2h-24h, 0% for <2h) and a limit of 2 free cancellations/month.
    - Add the "Two-Man Rule (OTP to Shift Supervisor)" requirement for Cash Refunds.
    - Add the "Credit Limit" constraint for Corporate Postpaid Debt.
- Update `/01-requirements/user_stories.md`: Add User Stories for the Two-Man Rule Cash Refund and the Multi-tiered Cancellation penalties.

**2. @Architect_Agent (System & Architecture Hardening):**
- Update `/02-architecture/system_design.md`: 
    - Document the "Saga Orchestration" flow for Late Webhooks (Auto-Refund via API if the slot was lost).
    - Document the "Transactional Outbox Pattern" for guaranteed message delivery.
- Update `/02-architecture/database_erd.md`:
    - Add `credit_limit` and `current_debt` columns to the Corporate/User tables.
    - Document the requirement for `SELECT ... FOR UPDATE` (Pessimistic Locking) and `CHECK (balance >= 0)` on the Wallet table.
    - Add an `OUTBOX_EVENTS` table to the ERD.
- Update `/02-architecture/api_contracts/booking_api.yaml`:
    - Enforce the `Idempotency-Key` header requirement for all POST endpoints.
    - Ensure API responses include error codes for "Credit Limit Exceeded".

**3. @QA_Agent (Test Scenario Updates):**
- Generate/Update Gherkin scenarios in `/04-testing/bdd_features/`:
    - Create a test for the "Double-Spending" Wallet attack (expecting a database lock or balance check failure).
    - Create a test for the "Late Webhook" scenario (expecting an auto-refund trigger).
    - Update the Cancellation scenarios to test the 24h, 2h-24h, and <2h penalty tiers.

**4. @PM_Agent (Sync & Control):**
- Rename `brd_v1.3.md` to `brd_v1.4.md` locally.
- Update `/03-project-management/project_context.yaml`: Bump version to `1.4` and flag architectural risks as "MITIGATED".
- Generate `/03-project-management/changelog_v1.4.md`: Summarize the artifacts updated in this run.

**Constraints:**
- ONLY implement the Mandatory Action Items from the evaluation report.
- Perform DELTA UPDATES to existing files to preserve unaffected context.
- Use valid Markdown, Mermaid JS, YAML, and Gherkin.

**Execute Pipeline Now.**
````

---

## 🏛️ Phase 3: Continuous Agile Development & State Management

### <a id="prompt-05"></a>05. # [SYSTEM COMMAND]: CONTINUOUS AGILE DEVELOPMENT & STATE MANAGEMENT

- **Bước thực thi trong phiên (Step Index):** Step 156
- **Giai đoạn/Ngữ cảnh (Phase/Context):** Used to transition from design to the development phase, establishing Sprint-by-Sprint state tracking via execution_state.yaml and dispatching Sprint 1 tasks.
- **Nội dung Master Prompt (Prompt Content):**

````markdown
# [SYSTEM COMMAND]: CONTINUOUS AGILE DEVELOPMENT & STATE MANAGEMENT
**Context:** The architecture and requirements (v1.4) are fully approved. We are now entering the Development & Coding phase. Due to context window and token limits, this project will be executed iteratively.

**Objective:** Orchestrate the agent crew to develop the system Sprint-by-Sprint. The `@PM_Agent` MUST actively manage the execution state, pausing and saving progress when token limits approach, allowing seamless resumption in the next session.

---

### PART 1: STATE MANAGEMENT PROTOCOL (Crucial)
**@PM_Agent MUST strictly follow this loop:**
1. **Load State:** Read `/03-project-management/execution_state.yaml` (Create it if it doesn't exist).
2. **Assign Task:** Identify the next `STATUS: PENDING` task in the current Sprint and dispatch it to the specific Agent (`@Dev_Agent` or `@QA_Agent`).
3. **Execute:** The assigned Agent performs the coding/testing task.
4. **Update State:** Once the task is done, `@PM_Agent` marks it `STATUS: DONE` in `execution_state.yaml`.
5. **Token Limit Checkpoint:** After completing ONE major task (or if the token limit is nearing), `@PM_Agent` MUST PAUSE the execution. It will output the updated `execution_state.yaml` and the exact command: `"[SYSTEM RESUME]: Proceed to the next pending task."` for the human to trigger the next run.

---

### PART 2: SPRINT ROADMAP & AGENT ASSIGNMENTS

#### SPRINT 1: Core Database & Resiliency Engine
*Goal: Lay the foundation with pessimistic locking, idempotency, and outbox pattern.*
* **Task 1.1 (Database Schema):** `@Dev_Agent` to generate `/src/database/schema_v1.sql` including Tables, Partial Indexes, `CHECK(balance >= 0)` constraint, and the `OUTBOX_EVENTS` table.
* **Task 1.2 (Idempotency Middleware):** `@Dev_Agent` to write `/src/middleware/idempotency.ts` using Redis to prevent duplicate POST requests.
* **Task 1.3 (Sprint 1 QA):** `@QA_Agent` to generate automated unit tests in `/test/sprint1/db_locks.test.ts` to simulate double-spending race conditions.

#### SPRINT 2: Booking Engine & Late Webhook Saga
*Goal: Implement the core business logic and third-party payment integration.*
* **Task 2.1 (Booking Logic):** `@Dev_Agent` to write `/src/services/BookingService.ts` handling the 10-minute Redis lock, Wallet deduction, and Cash on Arrival logic.
* **Task 2.2 (Saga Orchestration for Webhooks):** `@Dev_Agent` to write `/src/services/PaymentWebhookService.ts`. Must include logic for Auto-Refund if the Webhook arrives after the 10-minute TTL and the room is lost.
* **Task 2.3 (Sprint 2 QA):** `@QA_Agent` to write `/test/sprint2/webhook_saga.test.ts` to mock delayed VNPAY callbacks.

#### SPRINT 3: Web Admin & Frontend Constraints
*Goal: Implement the Admin Dashboard UI and the Two-Man Rule.*
* **Task 3.1 (Cash Booking UI):** `@Dev_Agent` to write React/Next.js components in `/frontend/admin/pages/cash-booking.tsx`.
* **Task 3.2 (Two-Man Rule OTP Logic):** `@Dev_Agent` to implement the OTP verification popup for "Cash Refund" in `/frontend/admin/components/RefundModal.tsx`.
* **Task 3.3 (Sprint 3 QA):** `@QA_Agent` to write End-to-End (E2E) Cypress tests in `/test/e2e/admin_cash_refund.cy.ts`.

---

### PART 3: EXECUTION INITIALIZATION
**Instructions for the Orchestrator:**
1. `@PM_Agent`: Initialize `/03-project-management/execution_state.yaml` based on the Roadmap above. Set all tasks to `PENDING`.
2. Begin **Task 1.1**.
3. Output the generated code for Task 1.1 into the correct file path.
4. Update `execution_state.yaml` to mark Task 1.1 as `DONE`.
5. Pause execution and ask the user to type `CONTINUE` to proceed to Task 1.2.

**Constraints for @Dev_Agent:**
- Write production-ready code (TypeScript/SQL). Include inline comments.
- Do NOT generate placeholder functions (`// to do`). Write the actual logic.

**Execute Pipeline Now. Start with Initialization and Task 1.1.**
````

---

### <a id="prompt-06"></a>06. [SYSTEM RESUME]: Proceed to the next pending task (Task 1.2)

- **Bước thực thi trong phiên (Step Index):** Step 164
- **Giai đoạn/Ngữ cảnh (Phase/Context):** Used to resume the autonomous development loop and proceed to Task 1.2 (Idempotency Middleware) in Sprint 1.
- **Nội dung Master Prompt (Prompt Content):**

````markdown
[SYSTEM RESUME]: Proceed to the next pending task.
````

---

### <a id="prompt-07"></a>07. [SYSTEM RESUME]: Proceed to the next pending task (Task 1.3)

- **Bước thực thi trong phiên (Step Index):** Step 170
- **Giai đoạn/Ngữ cảnh (Phase/Context):** Used to proceed to Task 1.3 (Sprint 1 QA: db_locks.test.ts) to complete Sprint 1.
- **Nội dung Master Prompt (Prompt Content):**

````markdown
[SYSTEM RESUME]: Proceed to the next pending task.
````

---

## 🏛️ Phase 4: Token Diagnostics, Context Compression & Session Continuity

### <a id="prompt-08"></a>08. # [SYSTEM COMMAND]: CONTEXT WINDOW & TOKEN USAGE DIAGNOSTIC

- **Bước thực thi trong phiên (Step Index):** Step 176
- **Giai đoạn/Ngữ cảnh (Phase/Context):** Used after Sprint 1 completion to evaluate memory capacity and token usage to prevent instruction loss or degradation before beginning Sprint 2.
- **Nội dung Master Prompt (Prompt Content):**

````markdown
# [SYSTEM COMMAND]: CONTEXT WINDOW & TOKEN USAGE DIAGNOSTIC
**Objective:** Evaluate the current memory capacity and token usage of this session to prevent truncation, hallucination, or loss of earlier instructions (such as the BRD or Architecture guidelines).

**Instructions for the AI:**
Please analyze our current conversation history and provide a diagnostic report with the following 4 points:

1. **Context Limit Status:** Based on your underlying model, what is your maximum context window (e.g., 8K, 32K, 128K, 1M tokens)?
2. **Current Usage Estimate:** Estimate the current usage of our conversation so far. Categorize it as:
   - [LOW]: Lots of memory left.
   - [MEDIUM]: Safe, but starting to build up.
   - [HIGH]: Approaching the limit; earlier messages might soon be forgotten.
   - [CRITICAL]: Immediate risk of context truncation.
3. **Instruction Retention Check:** Can you still clearly recall the core business rules from `brd_v1.4.md` (specifically the 10-minute lock and Multi-tiered cancellation)? Briefly summarize them to prove retention.
4. **Recommendation:** If the status is HIGH or CRITICAL, generate a concise "Context Compression Summary" containing all vital rules, states, and the roadmap, which I can use to start a brand new, fresh session.

**Execute Diagnostic Now.**
````

---

### <a id="prompt-09"></a>09. SAVE CONTEXT COMPRESSION SUMMARY & [SYSTEM RESUME] (Task 2.1)

- **Bước thực thi trong phiên (Step Index):** Step 178
- **Giai đoạn/Ngữ cảnh (Phase/Context):** Used to persist the context compression summary artifact to the workspace and proceed directly to Task 2.1 in Sprint 2.
- **Nội dung Master Prompt (Prompt Content):**

````markdown
save "Context Compression Summary)" to file in project and [SYSTEM RESUME]: Proceed to the next pending task.
````

---

### <a id="prompt-10"></a>10. [SYSTEM RESUME]: Proceed to the next pending task (Task 2.2)

- **Bước thực thi trong phiên (Step Index):** Step 186
- **Giai đoạn/Ngữ cảnh (Phase/Context):** Used to advance the development sequence to Task 2.2 (PaymentWebhookService Late Webhook Saga Auto-Refund) in Sprint 2.
- **Nội dung Master Prompt (Prompt Content):**

````markdown
[SYSTEM RESUME]: Proceed to the next pending task.
````

---

### <a id="prompt-11"></a>11. [SYSTEM RESUME]: Proceed to the next pending task (Task 2.3)

- **Bước thực thi trong phiên (Step Index):** Step 192
- **Giai đoạn/Ngữ cảnh (Phase/Context):** Used to advance to Task 2.3 (Sprint 2 QA: webhook_saga.test.ts) to complete Sprint 2.
- **Nội dung Master Prompt (Prompt Content):**

````markdown
[SYSTEM RESUME]: Proceed to the next pending task.
````

---

### <a id="prompt-12"></a>12. # [SYSTEM COMMAND]: CONTEXT DIAGNOSTIC & AUTO-RESUME PIPELINE

- **Bước thực thi trong phiên (Step Index):** Step 198
- **Giai đoạn/Ngữ cảnh (Phase/Context):** Used to perform an automated token check and conditional execution loop before transitioning into Sprint 3 (Web Admin & Two-Man Rule).
- **Nội dung Master Prompt (Prompt Content):**

````markdown
# [SYSTEM COMMAND]: CONTEXT DIAGNOSTIC & AUTO-RESUME PIPELINE
**Objective:** Evaluate token usage. If safe, automatically execute the next pending task. If critical, compress context into a file and pause safely.

**Instructions for @PM_Agent:**

**STEP 1: Token Usage Diagnostic**
Analyze current conversation memory. Categorize current usage as:
- [SAFE]: Plenty of context window remaining.
- [CRITICAL]: Nearing the limit, risk of losing earlier instructions.

**STEP 2: Conditional Execution Logic**

**Branch A: If status is [CRITICAL]**
1. Stop all development tasks.
2. Perform Context Compression: Condense all vital business rules (`brd_v1.4`), architecture constraints, and the remaining roadmap.
3. Output this compressed context inside a code block explicitly intended to be saved as:
   `/03-project-management/context_compression_summary.md`
4. Print the message: *"System paused due to token limits. Context compression saved. Please start a new session using the summary file."*
5. END PROCESS.

**Branch B: If status is [SAFE]**
1. Skip context compression.
2. Immediately load `/03-project-management/execution_state.yaml`.
3. Identify the very next task labeled `STATUS: PENDING`.
4. Dispatch the task to the appropriate Agent (@Dev_Agent or @QA_Agent).
5. Generate the code/test file for that specific task.
6. Provide the updated `execution_state.yaml` block marking the task as `DONE`.
7. Loop back to STEP 1 for the next task (or pause if you prefer manual confirmation after each task).

**Execute Diagnostic and Proceed Accordingly Now.**
````

---

## 🏛️ Phase 5: Integrity Auditing, Reporting & Scope Expansion

### <a id="prompt-13"></a>13. # [SYSTEM COMMAND]: WORKSPACE INTEGRITY AUDIT & FILE RECOVERY

- **Bước thực thi trong phiên (Step Index):** Step 249
- **Giai đoạn/Ngữ cảnh (Phase/Context):** Used to audit directory structure completeness across Sprints 1, 2, and 3, recovering any missing sprint logs, issue trackers, and OpenAPI specs.
- **Nội dung Master Prompt (Prompt Content):**

````markdown
# [SYSTEM COMMAND]: WORKSPACE INTEGRITY AUDIT & FILE RECOVERY
**Context:** Following the recent autonomous execution cycles, there is a risk that some required project files (e.g., specific sprint logs like `sprint_3_log.md`, updated acceptance criteria, or API docs) were omitted or not fully generated.

**Objective:** Orchestrate a cross-agent audit to verify the completeness of the project directory against the `project_context.yaml` and the overall Roadmap. Identify any missing files or incomplete documentation and generate them immediately.

**Execution Pipeline & Agent Tasks:**

**1. @PM_Agent (Workspace Auditor & Manager):**
- **Scan:** Cross-reference the required directory structure with the current roadmap (Sprints 1, 2, and 3).
- **Identify:** Detect if any project management files are missing (Focus check: `/03-project-management/sprint_logs/sprint_3_log.md`, `issue_tracker.md`, etc.).
- **Execute:** Generate any missing PM files. If `sprint_3_log.md` is missing, create it based on the Sprint 3 goals (Web Admin & Frontend Constraints) defined in the roadmap.

**2. @BA_Agent (Requirements Completeness Check):**
- **Scan:** Check `/01-requirements/`.
- **Execute:** Ensure that the Acceptance Criteria for Sprint 3 features (Cash Booking UI, Two-Man Rule OTP) exist. If missing, generate the necessary Markdown files in `/01-requirements/acceptance_criteria/`.

**3. @Architect_Agent (Design Completeness Check):**
- **Scan:** Check `/02-architecture/`.
- **Execute:** Verify if the API contracts and System Design documents fully cover the Sprint 3 UI requirements. Generate any missing endpoint specs (e.g., the Cash Refund OTP verification endpoint).

**4. Recovery & Reporting (All Agents):**
- Do NOT rewrite files that already exist and are complete. ONLY generate missing files or append missing sections.
- Once the recovery generation is complete, `@PM_Agent` must output a consolidated list:
  `[RECOVERY REPORT]: List of newly generated or fixed files.`

**Constraints:**
- Strictly follow the directory paths previously established.
- Ensure all newly generated files are fully populated, no empty templates or placeholder comments like `// to be added`.

**Execute Integrity Audit and Recovery Now.**
````

---

### <a id="prompt-14"></a>14. # [SYSTEM COMMAND]: COMPREHENSIVE PROJECT PROGRESS & STATUS REPORT

- **Bước thực thi trong phiên (Step Index):** Step 327
- **Giai đoạn/Ngữ cảnh (Phase/Context):** Used by the project owner to obtain a high-level status report, velocity assessment, and milestone progress check across all project management files.
- **Nội dung Master Prompt (Prompt Content):**

````markdown
# [SYSTEM COMMAND]: COMPREHENSIVE PROJECT PROGRESS & STATUS REPORT
**Context:** As the project owner, I need a high-level and detailed overview of the "Smart Meeting Room Booking System" project's current state to ensure all development efforts align with the roadmap and BRD v1.4.

**Objective:** `@PM_Agent` must read the project management files, analyze the current execution state, and generate a clear, structured progress report.

**Instructions for @PM_Agent:**

**1. Data Gathering (Read-Only Scan):**
- Read `/03-project-management/project_context.yaml` for the overall phase and version.
- Read `/03-project-management/execution_state.yaml` to check the exact `DONE` vs `PENDING` tasks.
- Scan `/03-project-management/sprint_logs/` and `/issue_tracker.md` to identify any active blockers.

**2. Generate Report:**
Output a detailed Markdown report formatted exactly as follows:

### 📊 PROJECT STATUS REPORT
**Date:** [Current Date]
**Current Phase:** [Phase name from context]
**Overall Completion:** [Calculate approximate % based on DONE vs Total tasks]

#### ✅ 1. COMPLETED REQUIREMENTS (What has been done)
- *List the major features, architectures, and tasks that are marked as `DONE` across all sprints.*
- *Mention the specific files generated (e.g., Database ERD, BookingService.ts, DB schema).*

#### ⏳ 2. PENDING REQUIREMENTS (What is not yet implemented)
- *List all tasks currently marked as `PENDING` or `IN_PROGRESS` in the execution state.*
- *Highlight any core business rules from BRD v1.4 (like Two-Man Rule, Auto-Refund) that have not been coded yet.*

#### ⚠️ 3. BLOCKERS & RISKS
- *Identify any missing files, blocked tasks, or architectural dependencies that are halting progress.*
- *If there are no blockers, explicitly state "System is clear, no blockers."*

#### 🚀 4. NEXT ACTION PLAN (What is next)
- *Provide a prioritized list of the immediate next 3 tasks that need to be executed in the upcoming cycle.*
- *Provide the exact `[SYSTEM RESUME]` command I need to copy/paste to trigger the next development step.*

**Constraints:**
- Do NOT generate any code or modify any project files during this run.
- ONLY output the Progress Report directly to the chat/console.

**Execute Progress Report Generation Now.**
````

---

### <a id="prompt-15"></a>15. # [SYSTEM COMMAND]: FRONTEND GAP ANALYSIS & DEVELOPMENT PLANNING

- **Bước thực thi trong phiên (Step Index):** Step 337
- **Giai đoạn/Ngữ cảnh (Phase/Context):** Used to identify the client application gap (Mobile App and Web Admin UI), halt premature UAT progression, and plan Sprint 3.5 (Frontend Development).
- **Nội dung Master Prompt (Prompt Content):**

````markdown
# [SYSTEM COMMAND]: FRONTEND GAP ANALYSIS & DEVELOPMENT PLANNING
**Context:** A review of the current project state reveals a critical gap: The backend APIs and infrastructure are planned, but the actual client applications (Mobile App for End-Users and Web Admin for Management) are missing from the immediate execution pipeline. We cannot proceed to UAT (Stage 4) without the User Interfaces.

**Objective:** `@PM_Agent` and `@BA_Agent` must audit the frontend requirements, halt the UAT progression, and generate a comprehensive Frontend Development Sprint Plan to build the client applications before End-to-End testing begins.

**Execution Pipeline & Agent Tasks:**

**1. @BA_Agent (Frontend Requirements Audit):**
- Review `brd_v1.4.md` focusing on Section 4 (Stakeholders) and Section 6 (BPMN Flows).
- Generate a new document: `/01-requirements/frontend_scope.md`.
- Detail the necessary screens and UI components for:
  - **Mobile App (End-User/Member):** Search/Filter Rooms, Booking Details, Payment Gateway Integration (VNPAY/Wallet), Booking History, and Cancellation UI.
  - **Web Admin Dashboard:** Booking Calendar/Grid View, Walk-in Cash Booking Interface, Postpaid Debt Management, and the "Two-Man Rule" OTP Refund Modal.

**2. @Architect_Agent (Frontend Technology Stack Selection):**
- Recommend and document the frontend technology stack in `/02-architecture/frontend_architecture.md`.
- Ensure the choice supports rapid multi-platform deployment (e.g., Flutter or React Native for Mobile, Next.js or React for Web Admin).
- Define how the frontend will handle optimistic UI updates and Idempotency Keys when communicating with the Booking API.

**3. @PM_Agent (Roadmap Realignment & Sprint Injection):**
- **CRITICAL ACTION:** Update `/03-project-management/project_context.yaml` and the master Roadmap to insert a new "Sprint 3.5: Frontend Application Development" *before* Stage 4 (UAT).
- Update `/03-project-management/execution_state.yaml` to include new `PENDING` tasks for `@Dev_Agent` to build the required screens outlined by `@BA_Agent`.
- Generate `/03-project-management/sprint_logs/sprint_3.5_log.md` detailing the frontend development tasks and assignments.

**Constraints:**
- Do not trigger Stage 4 UAT yet.
- Ensure the frontend plan specifically addresses the edge cases resolved in the previous architecture audit (e.g., handling the 10-minute lock UI countdown).

**Execute Pipeline Now.**
````

---

## 🏛️ Phase 6: Full Autonomous Execution & Codebase Completion

### <a id="prompt-16"></a>16. # [SYSTEM COMMAND]: FULL AUTONOMOUS EXECUTION & TOKEN DIAGNOSTIC PIPELINE

- **Bước thực thi trong phiên (Step Index):** Step 371
- **Giai đoạn/Ngữ cảnh (Phase/Context):** Used to trigger the supreme autonomous execution loop to complete all pending Sprint 3.5 tasks without manual intervention, reaching 100% development completion.
- **Nội dung Master Prompt (Prompt Content):**

````markdown
# [SYSTEM COMMAND]: FULL AUTONOMOUS EXECUTION & TOKEN DIAGNOSTIC PIPELINE
**Context:** The frontend development plan (Sprint 3.5) and all remaining backend tasks have been planned and logged in `/03-project-management/execution_state.yaml`. We now require fully automated execution of the codebase without manual intervention for each file.

**Objective:** `@PM_Agent` acts as the Supreme Orchestrator. It will continuously loop through all pending tasks, dispatching them to `@Dev_Agent` or `@QA_Agent`, while strictly monitoring the context window to prevent memory degradation.

**Instructions for @PM_Agent (The Autonomous Loop):**

**STEP 1: Token Usage Diagnostic**
Analyze current conversation memory and output generation limits. Categorize current usage as:
- [SAFE]: Plenty of context window remaining.
- [CRITICAL]: Nearing the limit, risk of losing earlier instructions or truncating the output.

**STEP 2: Conditional Execution Logic**

**Branch A: If status is [CRITICAL]**
1. Halt all development tasks immediately.
2. Perform Context Compression: Condense all vital business rules (`brd_v1.4`), architecture constraints, and the remaining pending tasks.
3. Output this compressed context inside a code block explicitly formatted to be saved as:
   `/03-project-management/context_compression_summary.md`
4. Print the exact message: *"🛑 System paused due to token limits. Context compression saved. Please start a new session and use [SYSTEM RESUME] with the summary file."*
5. END PROCESS (Break the loop).

**Branch B: If status is [SAFE]**
1. Load `/03-project-management/execution_state.yaml`.
2. Identify if there are any tasks labeled `STATUS: PENDING`. 
   - *If NO pending tasks exist*, proceed to **Branch C**.
   - *If PENDING tasks exist*, select the very next one in the sequence.
3. Dispatch the task to the appropriate Agent (e.g., `@Dev_Agent` to write the Next.js/React Native code, or `@QA_Agent` to write tests).
4. **EXECUTE:** The assigned Agent generates the full, production-ready code/test file for that specific task. Do NOT use placeholders.
5. Provide the updated `execution_state.yaml` block marking this specific task as `DONE`.
6. **AUTO-LOOP:** Immediately loop back to **STEP 1** and evaluate token safety again. Continue executing the next pending task automatically. Do NOT wait for human confirmation if the status is [SAFE].

**Branch C: If ALL Tasks are [DONE]**
1. Print the message: *"✅ All Sprint tasks successfully executed. The codebase is fully generated. The system is now ready for STAGE 4 UAT & LOAD TESTING."*
2. END PROCESS.

**Execute the Autonomous Loop Now.**
````

---

## 🏛️ Phase 7: Zero-Cost UAT Deployment & Testing Strategy

### <a id="prompt-17"></a>17. # [SYSTEM COMMAND]: ZERO-COST UAT DEPLOYMENT & TESTING STRATEGY

- **Bước thực thi trong phiên (Step Index):** Step 440
- **Giai đoạn/Ngữ cảnh (Phase/Context):** Used to design a $0 budget UAT deployment on Free-Tier cloud services (Vercel, Render, Neon Postgres, Upstash Redis), create operator guides, and formulate the UAT test playbook.
- **Nội dung Master Prompt (Prompt Content):**

````markdown
# [SYSTEM COMMAND]: ZERO-COST UAT DEPLOYMENT & TESTING STRATEGY
**Context:** The codebase for the "Smart Meeting Room Booking System" is successfully generated. We now need to deploy the system to a User Acceptance Testing (UAT) environment. The critical constraint is a **$0 budget**. We must utilize reliable Free-Tier cloud services to host the full stack (PostgreSQL, Redis, Node.js Backend, Next.js/React Frontend).

**Objective:** Orchestrate `@Architect_Agent`, `@Dev_Agent`, and `@QA_Agent` to design the UAT infrastructure, create deployment guides, generate deployment architecture diagrams, and formulate the UAT execution playbook. All artifacts must be saved in a new directory: `/05-deployment/`.

**Execution Pipeline & Agent Tasks:**

**1. @Architect_Agent (Zero-Cost Infrastructure Design):**
- Evaluate and select a $0 Free-Tier tech stack for UAT. Recommended stack to consider:
  - **Frontend (Web Admin & PWA):** Cloudflare Pages or Vercel.
  - **Backend (Node.js/NestJS API):** Render (Free Web Service) or Railway.
  - **Database (PostgreSQL):** Supabase or Neon.tech (Free Tier).
  - **Cache & Lock Manager (Redis):** Upstash (Serverless Redis Free Tier).
- Generate `/05-deployment/uat_architecture.md`: Detail the chosen services, limitations of the free tiers (e.g., cold starts, sleep after 15 mins of inactivity), and include a **Mermaid Node/Deployment Diagram** showing how these external services connect.

**2. @Dev_Agent (Deployment Playbook & Configurations):**
- Generate `/05-deployment/deployment_guide.md`: A step-by-step manual for the human operator to provision these free resources. Include instructions on setting up environment variables (`.env`), database connection strings, and connecting GitHub repositories for CI/CD auto-deploy.
- Generate `/05-deployment/docker-compose.local-uat.yml`: For fallback local testing, provide a Docker Compose file that spins up the entire stack locally in case the free cloud services hit their limits during UAT.

**3. @QA_Agent (UAT Execution Playbook):**
- Generate `/05-deployment/uat_test_playbook.md`: Create a structured UAT execution plan for the human testers. 
- The playbook must include clear, step-by-step test cases for:
  - Happy Path (Search, Book, Pay, Confirm).
  - Edge Cases (10-minute TTL timeout, Walk-in cash refund with Two-Man Rule).
  - Include a "Sign-off" checklist matrix at the bottom of the document.

**4. @PM_Agent (Supervision & Logging):**
- Verify that all three files (`uat_architecture.md`, `deployment_guide.md`, `uat_test_playbook.md`) and the `docker-compose` file are fully generated in the `/05-deployment/` directory.
- Update `/03-project-management/execution_state.yaml` and `project_context.yaml` to reflect the transition into the UAT Phase.
- Do NOT execute the deployment. Only prepare the exact instructions for the human operator.

**Constraints:**
- Strictly adhere to the $0 budget constraint. Do not recommend AWS EC2, Google Cloud SQL, or anything requiring a credit card with immediate billing risks.
- Ensure the Mermaid diagrams are perfectly formatted for markdown viewers.

**Execute Pipeline Now.**
````

---

## 🏛️ Phase 8: Project Prompt Logging & Knowledge Preservation

### <a id="prompt-18"></a>18. # [SYSTEM COMMAND]: COMPILE AND EXPORT PROJECT PROMPT LOG

- **Bước thực thi trong phiên (Step Index):** Step 474
- **Giai đoạn/Ngữ cảnh (Phase/Context):** Used to aggregate and export the complete chronological history of all master system commands and resume prompts into a reusable project framework.
- **Nội dung Master Prompt (Prompt Content):**

````markdown
# [SYSTEM COMMAND]: COMPILE AND EXPORT PROJECT PROMPT LOG
**Context:** As the "Smart Meeting Room Booking System" project has progressed through multiple phases (Requirements gathering, Architecture audit, Sprint planning, and Autonomous development), we have utilized several complex "Master Prompts" to orchestrate the AI Agent crew. We need to document these instructions to create a repeatable framework for future projects.

**Objective:** `@PM_Agent` must review the conversation history and compile all primary system commands and master prompts used throughout this project's lifecycle into a single, well-organized Markdown file.

**Instructions for @PM_Agent:**

**1. Data Gathering (Memory Scan):**
- Scan the conversation history for all major instructional blocks designed to orchestrate the agents. Look for commands starting with `# [SYSTEM COMMAND]` or `# [SYSTEM RESUME]`.

**2. Compilation & Formatting:**
- Generate a new file named `/03-project-management/project-prompt-log.md`.
- Organize the prompts chronologically or by project phase (e.g., Initialization, Audit & Refinement, State Management, Autonomous Execution).
- For each entry in the log, include:
    - **Phase/Context:** A brief (1-2 sentence) explanation of when and why this prompt was used.
    - **Prompt Content:** The exact text of the prompt, enclosed in a Markdown code block (` ```markdown `).

**3. Execution Constraints:**
- Do not alter the original text of the prompts; record them exactly as they were used.
- Ensure the output file uses clear Markdown headers (`##`, `###`) for readability.
- ONLY output the content for `/03-project-management/project-prompt-log.md`. Do not execute any further development tasks.

**Execute Prompt Logging Now.**
````

---
