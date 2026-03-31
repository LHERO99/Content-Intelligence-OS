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

## Password Hashing

For security, passwords in Airtable **must** be stored as bcrypt hashes. Do not store plain-text passwords.

To generate a hashed password for a user, run the following command in your terminal:

```bash
npx tsx src/scripts/hash-password.ts your_password_here
```

Copy the generated hash and paste it into the `Password` field in your Airtable `Users` table.
