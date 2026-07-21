# FYCD HD Manager

Baserow-inspired database workspace built with Next.js, Prisma, TiDB, and Redis.

## Stack

- Frontend: Next.js on Vercel
- Database: TiDB
- ORM: Prisma
- Cache / queue: Redis

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Configure these in `.env.local` and in Vercel project settings:

```env
DATABASE_URL="your_tidb_connection_string"
REDIS_URL="your_redis_connection_string"
NEXT_PUBLIC_APP_NAME="Baserow"
```

If you add attachments or imported files, provide an object storage service as well.

## Deploy on Vercel

1. Connect the repository to Vercel.
2. Set `DATABASE_URL` to TiDB.
3. Set `REDIS_URL` if you use cache, jobs, or background sync.
4. Run Prisma migrations during deploy or from a separate release step.
5. Add storage for uploads if needed.

## Notes

- The UI is being tuned toward Baserow's light workspace, grid-first layout, and common table actions.
- The repo already contains table, form, kanban, gallery, calendar, and timeline surfaces that can be refined further.
