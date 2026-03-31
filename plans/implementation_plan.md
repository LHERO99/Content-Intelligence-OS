# Implementation Plan: SEO Content Intelligence OS

This document provides actionable implementation steps for each component of the architecture.

---

## 1. Airtable Setup (SSOT)
**Goal:** Establish the relational database structure.

- [ ] Create a new Airtable Base "SEO Content Intelligence OS".
- [ ] **Users Table:** Fields: `Name` (Text), `Email` (Email), `Role` (Single Select: Admin, Editor), `API_Key` (Text).
- [ ] **Keyword-Map Table:** Fields: `Keyword` (Text), `Target_URL` (URL), `Search_Volume` (Number), `Difficulty` (Number), `Status` (Single Select: Backlog, Planned, In Progress, Published), `Editorial_Deadline` (Date).
- [ ] **Potential_Trends Table:** Fields: `Trend_Topic` (Text), `Source` (Single Select: GSC, Sistrix), `Gap_Score` (Number), `Status` (Single Select: New, Claimed, Blacklisted).
- [ ] **Content-Log Table:** Fields: `Keyword_ID` (Link to Keyword-Map), `Version` (Single Select: v1, v2), `Content_Body` (Long Text), `Diff_Summary` (Long Text), `Editor_ID` (Link to Users).
- [ ] **Performance_Data Table:** Fields: `Keyword_ID` (Link to Keyword-Map), `Date` (Date), `GSC_Clicks` (Number), `GSC_Impressions` (Number), `Sistrix_VI` (Number), `Time_to_Rank` (Formula).
- [ ] **Audit_Logs Table:** Fields: `Action` (Text), `Timestamp` (Created Time), `User_ID` (Link to Users), `Reasoning_Chain` (Long Text), `Raw_MCP_Response` (Long Text).

---

## 2. n8n Orchestration & MCP Integration
**Goal:** Build the execution engine.

- [ ] **MCP Host Setup:** Configure n8n to host MCP servers for Sistrix, GSC, and DataForSEO.
- [ ] **Workflow: Trend Ingestion:**
    - Trigger: Cron (Daily).
    - Action: Fetch data from Sistrix/Google Trends via MCP.
    - Logic: Filter against "Blacklisted" trends in Airtable.
    - Action: Create new records in `Potential_Trends`.
- [ ] **Workflow: Content Diagnosis (Closed Loop):**
    - Trigger: Cron (Weekly) or Webhook.
    - Action: Fetch GSC performance via MCP.
    - Logic: Detect drops >20%.
    - Action: Trigger Competitor Analysis via DataForSEO MCP.
    - Action: Generate AI Proposal and push to `Content-Log` (v2).
- [ ] **Workflow: UI Trigger Handler:**
    - Trigger: Webhook (from Next.js).
    - Action: Execute requested task (e.g., "Generate Draft").
    - Action: Update Airtable status and push logs to `Audit_Logs`.

---

## 3. Next.js Frontend (Dashboard & Navigation)
**Goal:** Build the UI shell and KPI overview.

- [ ] **Theme Configuration:** Set up Tailwind with Deep Forest (`#00463c`) and Mint Mist (`#e7f3ee`).
- [ ] **Layout:** Implement a sidebar navigation with sections: Dashboard, Content-Planning, Content-Creation, Content-Monitoring.
- [ ] **Dashboard View:**
    - Implement KPI Cards (Visibility Index, Total Clicks, Active Trends).
    - Implement a "Recent Alerts" feed from the `Audit_Logs` table.
    - Use `recharts` for performance trend visualization.

---

## 4. Content-Planning Module
**Goal:** Manage keywords and editorial pipeline.

- [ ] **Keyword-Map View:** Implement a searchable/filterable table (shadcn/ui `DataTable`) connected to Airtable.
- [ ] **Editorial Plan:** Implement a calendar view or Kanban board for content status.
- [ ] **Trends View:** 
    - Display `Potential_Trends` with "Claim" and "Blacklist" buttons.
    - "Claim" button triggers an n8n webhook to move the trend to the `Keyword-Map`.

---

## 5. Content-Creation Module (AI Editor & Scoring)
**Goal:** The "Forge" for content production.

- [ ] **AI Editor Component:**
    - Implement a side-by-side view (v1 vs v2).
    - Integrate `jsdiff` to highlight changes.
    - Add "Approve AI Proposal" button to overwrite v1 with v2.
- [ ] **Scoring Engine:**
    - Implement three sliders (SEO, Brand, Technical).
    - Visual feedback (Gauge or Progress bar) based on slider values.
- [ ] **Reasoning Log:** A collapsible panel showing the `Reasoning_Chain` for the current draft.

---

## 6. Content-Monitoring & ROI Module
**Goal:** Track performance and efficiency.

- [ ] **Performance Tracker:** Detailed view per keyword showing GSC and Sistrix data over time.
- [ ] **ROI Calculator:** Logic to display "Time-to-Rank" (Days between `Published` date and `Top 10` ranking).
- [ ] **Efficiency Metrics:** Cost per rank or traffic gain per content update.

---

## 7. NextAuth.js RBAC & Security
**Goal:** Secure the platform.

- [ ] **Provider Setup:** Configure NextAuth.js with Credentials or OAuth provider.
- [ ] **Role Logic:** 
    - Middleware to protect `/admin` routes.
    - Conditional rendering in the UI based on `session.user.role`.
- [ ] **API Security:** Ensure all n8n webhook calls are signed or use a secret header.
