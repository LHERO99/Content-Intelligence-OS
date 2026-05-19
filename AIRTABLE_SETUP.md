# Environment Variables

The following environment variables are required for the Airtable integration:

- `AIRTABLE_API_KEY`: Your Airtable Personal Access Token (PAT).
- `AIRTABLE_BASE_ID`: The ID of the Airtable base (found in the API documentation for your base).

## Setup

1. Create a `.env.local` file in the root of the project.
2. Add the variables:
   ```env
   AIRTABLE_API_KEY=your_token_here
   AIRTABLE_BASE_ID=your_base_id_here
   ```

## Table Schema: Users

To enable authentication, ensure your `Users` table has the following fields:

- `Name`: Single line text
- `Email`: Email (used for login)
- `Password`: Single line text (stored as a bcrypt hash)
- `Role`: Single select (`Admin`, `Editor`, `Viewer`)
- `Password_Changed`: Checkbox

## Table Schema: Keyword-Map

- `Keyword`: Single line text (Primary)
- `Target_URL`: URL
- `Search_Volume`: Number
- `Difficulty`: Number (0-100)
- `Status`: Single select (`Backlog`, `Planned`, `In Progress`, `Published`)
- `Editorial_Deadline`: Date
- `Assigned_Editor`: Link to `Users`

## Table Schema: Potential_Trends

- `Trend_Topic`: Single line text (Primary)
- `Source`: Single select (`GSC`, `Sistrix`)
- `Gap_Score`: Number
- `Status`: Single select (`New`, `Claimed`, `Blacklisted`)

## Table Schema: Blacklist

- `Keyword`: Single line text (Primary)
- `Type`: Single select (`Keyword`, `URL`) - **Required for URL blacklisting**
- `Reason`: Long text
- `Added_At`: Date (with time)

## Table Schema: Config

- `Key`: Single line text (Primary)
- `Value`: Long text
- `Description`: Single line text
- `Updated_At`: Date (with time)

## Table Schema: Content-Log

- `ID`: Autonumber (Primary)
- `Keyword_ID`: Link to `Keyword-Map`
- `Version`: Single select (`v1`, `v2`)
- `Content_Body`: Long text
- `Diff_Summary`: Long text
- `Reasoning_Chain`: Long text
- `Created_At`: Date (with time)

## Table Schema: Performance_Data

- `ID`: Autonumber (Primary)
- `Keyword_ID`: Link to `Keyword-Map`
- `Date`: Date
- `GSC_Clicks`: Number
- `GSC_Impressions`: Number
- `Sistrix_VI`: Number
- `Position`: Number

## Table Schema: Audit_Logs

- `ID`: Autonumber (Primary)
- `Action`: Single line text
- `Timestamp`: Date (with time)
- `User_ID`: Link to `Users`
- `Raw_Payload`: Long text

## Password Hashing

For security, passwords in Airtable **must** be stored as bcrypt hashes. Do not store plain-text passwords.

To generate a hashed password for a user, run the following command in your terminal:

```bash
npx tsx src/scripts/hash-password.ts your_password_here
```

Copy the generated hash and paste it into the `Password` field in your Airtable `Users` table.
