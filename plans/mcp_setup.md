# MCP Integration Guide for n8n

This document details how n8n should be configured to interface with Sistrix, Google Search Console (GSC), and DataForSEO MCP servers within the SEO Content Intelligence OS.

## 1. Overview

n8n acts as the central orchestration engine. It uses the **Model Context Protocol (MCP)** to communicate with specialized SEO tools. This allows n8n to perform complex SEO tasks like keyword gap analysis, SERP monitoring, and performance auditing.

## 2. MCP Server Configuration

Each MCP server should be accessible via a standardized interface (e.g., HTTP/SSE or Stdio if running locally with n8n).

### A. Sistrix MCP Server
- **Purpose:** Fetch Visibility Index (VI) and Keyword Gaps.
- **Key Tools:**
  - `get_visibility_index(domain)`
  - `get_keyword_gaps(domain, competitor_domain)`
- **n8n Integration:** Use the `HTTP Request` node or a custom `MCP Node` to call these tools.

### B. Google Search Console (GSC) MCP Server
- **Purpose:** Retrieve actual performance data (clicks, impressions, position).
- **Key Tools:**
  - `get_performance_data(site_url, start_date, end_date)`
  - `inspect_url(url)`
- **n8n Integration:** Requires OAuth2 credentials for GSC API, wrapped by the MCP server for simplified tool access.

### C. DataForSEO MCP Server
- **Purpose:** Deep SERP analysis and competitor content auditing.
- **Key Tools:**
  - `get_serp_results(keyword, location)`
  - `analyze_competitor_content(url)`
- **n8n Integration:** Used primarily in the "Content Diagnosis" (Closed Loop) workflow.

## 3. Workflow Implementation in n8n

### Workflow: UI Webhook Handler
1. **Webhook Node:** Listens for POST requests from Next.js (`/api/n8n/trigger`).
2. **Verify API Key:** Check `X-API-KEY` header.
3. **Switch Node:** Route based on `action_type`:
   - `CLAIM_TREND`: Move record from `Potential_Trends` to `Keyword-Map` in Airtable.
   - `GENERATE_DRAFT`: Trigger AI (GPT-4o/Claude) to create content based on MCP SERP data.
   - `APPROVE_PROPOSAL`: Update `Keyword-Map` with the new content version.
4. **Response Node:** Return success/failure to the Next.js app.

### Workflow: Closed-Loop Diagnosis
1. **Cron Trigger:** Weekly.
2. **Airtable Node:** Fetch all `Published` keywords.
3. **GSC MCP Node:** Get performance for the last 7 days vs. previous 7 days.
4. **Filter Node:** Identify drops > 20%.
5. **DataForSEO MCP Node:** Analyze current SERP for those keywords.
6. **AI Node:** Generate "v2" improvement proposal.
7. **Airtable Node:** Create record in `Content-Log`.

## 4. Security

- **X-API-KEY:** All incoming webhooks to n8n must be authenticated.
- **Environment Variables:** Store MCP server URLs and API keys in n8n's environment variables.
