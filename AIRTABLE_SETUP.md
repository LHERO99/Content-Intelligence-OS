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
