// PreToolUse (git commit): run `npm run verify`; exit 2 blocks the commit and shows Claude the failure.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// The settings `if` filter is best-effort and also fires on commands it cannot parse; re-check here.
const command = JSON.parse(readFileSync(0, 'utf8')).tool_input?.command ?? ''
if (!/\bgit\b[^\n|;&]*\bcommit\b/.test(command)) process.exit(0)

const root = path.resolve(import.meta.dirname, '..', '..')
try {
  execSync('npm run verify', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
} catch (err) {
  const out = `${err.stdout ?? ''}\n${err.stderr ?? ''}`.trim().split('\n')
  process.stderr.write(`npm run verify 失敗，已阻擋 commit。修到通過後再 commit。\n${out.slice(-40).join('\n')}\n`)
  process.exit(2)
}
