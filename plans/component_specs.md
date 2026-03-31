# Component Specifications: SEO Content Intelligence OS

This document provides detailed descriptions and development requirements for each component.

---

## 1. Airtable SSOT (Single Source of Truth)
**Description:** The central database for all SEO data, content versions, and audit logs.

### Development Requirements:
- [ ] **Base Setup:** Create a base named "SEO Content Intelligence OS".
- [ ] **Table: Keyword-Map:**
    - `Keyword` (Single line text, Primary)
    - `Target_URL` (URL)
    - `Search_Volume` (Number)
    - `Difficulty` (Number)
    - `Status` (Single select: Backlog, Planned, In Progress, Published)
    - `Editorial_Deadline` (Date)
    - `Assigned_Editor` (Link to Users)
- [ ] **Table: Content-Log:**
    - `ID` (Autonumber, Primary)
    - `Keyword_ID` (Link to Keyword-Map)
    - `Version` (Single select: v1, v2)
    - `Content_Body` (Long text, Rich text enabled)
    - `Diff_Summary` (Long text)
    - `Reasoning_Chain` (Long text)
    - `Created_At` (Created time)
- [ ] **Table: Performance_Data:**
    - `ID` (Autonumber, Primary)
    - `Keyword_ID` (Link to Keyword-Map)
    - `Date` (Date)
    - `GSC_Clicks` (Number)
    - `GSC_Impressions` (Number)
    - `Sistrix_VI` (Number)
    - `Position` (Number)
- [ ] **Table: Potential_Trends:**
    - `Trend_Topic` (Single line text, Primary)
    - `Source` (Single select: GSC, Sistrix)
    - `Gap_Score` (Number)
    - `Status` (Single select: New, Claimed, Blacklisted)
- [ ] **Table: Audit_Logs:**
    - `ID` (Autonumber, Primary)
    - `Action` (Single line text)
    - `Timestamp` (Created time)
    - `User_ID` (Link to Users)
    - `Raw_Payload` (Long text)

---

## 2. n8n Orchestration & MCP Integration
**Description:** The execution engine that connects the UI to external SEO APIs and AI models.

### Development Requirements:
- [ ] **MCP Server Configuration:**
    - Set up MCP servers for Sistrix (Visibility Index, Keyword Gaps).
    - Set up MCP servers for Google Search Console (Performance, URL Inspection).
    - Set up MCP servers for DataForSEO (SERP Analysis).
- [ ] **Workflow: Trend Ingestion:**
    - Trigger: Daily Cron.
    - Action: Fetch keyword gaps from Sistrix MCP.
    - Logic: Filter out keywords already in `Keyword-Map` or `Potential_Trends` (Blacklisted).
    - Action: Create new records in `Potential_Trends`.
- [ ] **Workflow: Content Diagnosis (Closed Loop):**
    - Trigger: Weekly Cron.
    - Action: Fetch GSC performance for all `Published` keywords.
    - Logic: Identify keywords with >20% drop in clicks WoW.
    - Action: Trigger DataForSEO MCP to analyze current SERP competitors.
    - Action: Generate AI proposal (v2) using GPT-4o/Claude 3.5.
    - Action: Push v2 to `Content-Log` and update `Keyword-Map` status to "In Progress".
- [ ] **Workflow: UI Webhook Handler:**
    - Trigger: POST Webhook from Next.js.
    - Action: Parse `action_type` (e.g., "GENERATE_DRAFT", "CLAIM_TREND").
    - Action: Execute corresponding logic and return success/failure to UI.

---

## 3. Next.js Dashboard & Navigation
**Description:** The main entry point and KPI overview.

### Development Requirements:
- [ ] **Theme & Layout:**
    - Implement Deep Forest (`#00463c`) and Mint Mist (`#e7f3ee`) color scheme.
    - Sidebar navigation with icons (Lucide-react).
- [ ] **Dashboard View:**
    - **KPI Cards:** Total Visibility Index (Sum of latest Sistrix_VI), Total GSC Clicks (Last 30 days), Active Trends (Count of "New" trends).
    - **Performance Chart:** Line chart showing Visibility Index trend over time using `recharts`.
    - **Alerts Feed:** List of recent "Closed Loop" diagnoses from `Audit_Logs`.

---

## 4. Content-Planning Module
**Description:** Strategic management of keywords and editorial tasks.

### Development Requirements:
- [ ] **Keyword-Map Table:**
    - Implement a shadcn/ui `DataTable` with sorting and filtering.
    - Inline editing for `Status` and `Editorial_Deadline`.
- [ ] **Editorial Calendar:**
    - Implement a calendar view showing keywords by their `Editorial_Deadline`.
- [ ] **Trend Radar:**
    - Card-based view of `Potential_Trends`.
    - "Claim" button: Triggers n8n webhook to move trend to `Keyword-Map`.
    - "Blacklist" button: Updates status in Airtable to "Blacklisted".

---

## 5. Content-Creation Module (AI Editor & Scoring)
**Description:** The workspace for content production and AI collaboration.

### Development Requirements:
- [ ] **AI Editor Workspace:**
    - Side-by-side layout: Left (v1 - Current), Right (v2 - AI Proposed).
    - Integration of `react-diff-viewer` to highlight changes.
    - "Approve AI Proposal" button: Triggers n8n to update v1 with v2 content.
- [ ] **Scoring Engine:**
    - Three sliders: SEO Readiness, Brand Voice, Technical Health.
    - Real-time score calculation (Average of sliders).
    - Visual gauge component showing the total score.
- [ ] **Reasoning Panel:**
    - Collapsible sidebar showing the `Reasoning_Chain` from the `Content-Log`.

---

## 6. Content-Monitoring & ROI Module
**Description:** Performance tracking and efficiency analysis.

### Development Requirements:
- [ ] **Performance Detail View:**
    - Per-keyword dashboard showing GSC Clicks vs Impressions.
    - Sistrix Visibility Index trend for the specific target URL.
- [ ] **ROI Metrics:**
    - Calculate "Time-to-Rank": `Date of Top 10 Ranking` minus `Date of Content Update`.
    - Display "Efficiency Score": Traffic gain per content version update.

---

## 7. NextAuth.js RBAC & Security
**Description:** Access control and API security.

### Development Requirements:
- [ ] **Authentication:**
    - Implement NextAuth.js with Credentials provider (Email/Password).
- [ ] **RBAC (Role-Based Access Control):**
    - **Admin:** Full access to all views and API settings.
    - **Editor:** Access to Planning, Creation, and Monitoring. No access to User management or API keys.
- [ ] **API Security:**
    - All requests to n8n webhooks must include an `X-API-KEY` header.
    - Implement rate limiting on the Next.js API routes.
