// PostToolUse (Edit|Write): run `eslint --fix` on the edited file only.
// Remaining errors are fed back to Claude via `decision: "block"` so it fixes them right away.
// Pre-existing errors frozen in eslint-suppressions.json do not count.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const LINTABLE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

const input = JSON.parse(readFileSync(0, 'utf8'))
const file = input.tool_input?.file_path
const root = path.resolve(import.meta.dirname, '..', '..')
if (!file || !LINTABLE.has(path.extname(file))) process.exit(0)

const rel = path.relative(root, file)
if (rel.startsWith('..') || /(^|[\\/])(node_modules|\.next)[\\/]/.test(rel)) process.exit(0)

const eslintBin = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js')
let stdout
try {
  stdout = execFileSync(
    process.execPath,
    [eslintBin, '--fix', '--format', 'json', '--pass-on-unpruned-suppressions', '--no-warn-ignored', file],
    { cwd: root, encoding: 'utf8' }
  )
} catch (err) {
  // eslint exits 1 when errors remain; anything else is a crash
  if (err.status !== 1 || !err.stdout) {
    process.stderr.write(`post-edit-lint: eslint failed to run: ${err.message}\n`)
    process.exit(1)
  }
  stdout = err.stdout
}

const errors = JSON.parse(stdout).flatMap((r) => r.messages.filter((m) => m.severity === 2))
if (errors.length === 0) process.exit(0)

const lines = errors.slice(0, 20).map((m) => `${rel}:${m.line}:${m.column} ${m.message} (${m.ruleId})`)
if (errors.length > 20) lines.push(`…還有 ${errors.length - 20} 個錯誤`)
process.stdout.write(
  JSON.stringify({
    decision: 'block',
    reason: `eslint --fix 後仍有 ${errors.length} 個錯誤，請修正：\n${lines.join('\n')}`,
  })
)
