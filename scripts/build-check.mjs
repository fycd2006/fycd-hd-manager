// Compile-only build used by `npm run verify`.
// Unlike `npm run build`, this never runs `prisma db push`, so it cannot touch the database.
// next build evaluates route modules, which require SESSION_SECRET; fill a placeholder when unset.
import { execSync } from 'node:child_process'

const env = { ...process.env }
if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
  env.SESSION_SECRET = 'build-check-placeholder-not-a-real-secret-000'
}

execSync('npx prisma generate', { stdio: 'inherit', env })
execSync('npx next build', { stdio: 'inherit', env })
