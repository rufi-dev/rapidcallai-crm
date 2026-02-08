# CRM Service

Standalone microservice for managing contacts, leads, and campaigns in RapidCallAI.

## Features

- Contact CRUD operations
- Search and filtering
- CSV import
- Auto-create from calls
- Call history integration
- Outbound job tracking

## Setup

1. Copy `.env.example` to `.env` and configure:
   ```bash
   DATABASE_URL=postgresql://user:password@host:5432/database
   DATABASE_SSL=true
   PORT=8788
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run locally:
   ```bash
   npm run dev
   ```

## API Endpoints

All endpoints require authentication via Bearer token or cookie.

- `GET /api/crm/contacts` - List contacts (with search/filter)
- `GET /api/crm/contacts/:id` - Get contact with call history
- `POST /api/crm/contacts` - Create contact
- `PUT /api/crm/contacts/:id` - Update contact
- `DELETE /api/crm/contacts/:id` - Delete contact
- `POST /api/crm/contacts/import` - Import CSV
- `POST /api/crm/contacts/backfill` - Backfill from existing data
- `POST /api/crm/contacts/upsert-from-call` - Auto-create from call (internal)

## Docker

```bash
docker build -t crm-service .
docker run -p 8788:8788 --env-file .env crm-service
```

## Health Check

```bash
curl http://localhost:8788/health
```

## Database

Shares PostgreSQL database with main API. Requires `contacts` table (created by main API schema).

## Performance

Optimized for 100K+ contacts:
- Database connection pooling (20 connections)
- Indexed queries
- Pagination support
- Efficient search queries
