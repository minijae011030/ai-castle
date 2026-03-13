# 🏰 AI Castle: Project Blueprint

## 1. Core Identity

- System Type: Hierarchical Multi-Agent Proactive Scheduler.
- Persona: 'Kim Ju-young' (Main Agent - Supervisor) & 'Subject Teachers' (Sub-Agents - Workers).
- Goal: Managing User('Ye-seo')'s schedule & learning progress proactively based on personal biorhythms and deadlines.

## 2. Key Modules & Logic (Technical Specs)

### A. Dynamic Scheduling (Proactive Routine)

- Trigger: User-defined day_start_time & day_end_time.
- Logic:
  1. Start Batch: Triggered at day_start_time. Main Agent analyzes calendar → Assigns tasks to Sub-Agents → Generates daily TODO.
  2. End Batch: Triggered at day_end_time. Sub-Agents submit reports → Main Agent summarizes daily progress and provides feedback.
- Tech: Spring Scheduler (Polling/Dynamic) + FCM Push Notification.

### B. Two-way Negotiation (Rescheduling)

- Trigger: User feedback on generated TODO (e.g., "Too much work today").
- Logic: Main Agent re-evaluates task priority → Requests Sub-Agents to reduce workload → Updates Todo status (NEGOTIATING → ACCEPTED) & shifts dates.
- Tech: Recursive Prompting (Main ↔ Sub) + DB Transaction.

### C. HITL (Calendar Priority)

- Trigger: External Calendar_Events (Manual User Input).
- Logic: Calendar data = Absolute Truth. AI must inject these events into the prompt context first.
- Tech: Prompt Context Injection (RAG-lite) + Hard Constraint logic in scheduling.

## 3. Multi-Agent Architecture

### 3.1. Main Agent (Supervisor):

- High-level strategy, Biorhythm management, Sub-agent orchestration.
- Input: Calendar, User Routine. Output: Task delegation to Sub-Agents.

## 3.2. Sub-Agents (Workers):

- Domain-specific (Algo, SQL, CS).
- Input: Main Agent's direction. Output: Specific TODOs & Technical feedback.

## 4. Technical Constraints (Dev Rules)

- Performance: All Sub-Agent API calls must be executed in parallel using CompletableFuture.
- Data Integrity: All AI outputs must be Structured JSON for system parsing.
- Scalability: Prompts must be fetched from Agent_Roles table (Dynamic Prompting).
- Memory: Use a Sliding Window (last N reports) for context management to prevent hallucination.
