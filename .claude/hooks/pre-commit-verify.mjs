// PreToolUse (git commit): run `npm run verify`; exit 2 blocks the commit and shows Claude the failure.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// The hook fires on every Bash/PowerShell call (a settings `if` filter misses forms like `git -C dir commit`),
// so this regex is the only filter: `git`, optional global options, then the `commit` subcommand.
const command = JSON.parse(readFileSync(0, 'utf8')).tool_input?.command ?? ''
if (!/\bgit(\s+(-C|-c)\s+\S+|\s+--?[\w-]+(=\S+)?)*\s+commit\b/.test(command)) process.exit(0)

const root = path.resolve(import.meta.dirname, '..', '..')
try {
  execSync('npm run verify', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
} catch (err) {
  const out = `${err.stdout ?? ''}\n${err.stderr ?? ''}`.trim().split('\n')
  process.stderr.write(`npm run verify 失敗，已阻擋 commit。修到通過後再 commit。\n${out.slice(-40).join('\n')}\n`)
  process.exit(2)
}
