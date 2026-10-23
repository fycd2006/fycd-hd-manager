// PostToolUse (Edit|Write / edit_file|write_file): run `eslint --fix` on the edited file only.
// - Claude Code: remaining errors are fed back via `decision: "block"`.
// - Antigravity: remaining errors are recorded to a per-conversation temp file and injected by `post-invocation-lint.mjs` (`force_continue`).
// Pre-existing errors frozen in eslint-suppressions.json do not count.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const LINTABLE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

let input = {}
try {
  const raw = readFileSync(0, 'utf8').trim()
  if (raw) input = JSON.parse(raw)
} catch {
  process.exit(0)
}
const file = input.tool_input?.file_path || input.toolCall?.args?.Path || input.toolCall?.args?.path
const hookRoot = path.resolve(import.meta.dirname, '..', '..')
if (!file || !LINTABLE.has(path.extname(file))) {
  if (input.toolCall) process.stdout.write('{}')
  process.exit(0)
}

// Resolve the file's own git worktree root so files inside `.claude/worktrees/<name>` are linted
// against their own worktree (main checkout's eslint.config.mjs ignores `.claude/worktrees/**`).
let root = hookRoot
try {
  const wtRoot = path.resolve(
    execFileSync('git', ['-C', path.dirname(file), 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  )
  if (existsSync(path.join(wtRoot, 'node_modules', 'eslint', 'bin', 'eslint.js'))) {
    root = wtRoot
  }
} catch {
  // Fallback to hookRoot
}

const rel = path.relative(root, file)
if (rel.startsWith('..') || /(^|[\\/])(node_modules|\.next)[\\/]/.test(rel)) {
  if (input.toolCall) process.stdout.write('{}')
  process.exit(0)
}

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
    if (input.toolCall) {
      process.stdout.write('{}')
      process.exit(0)
    }
    process.exit(1)
  }
  stdout = err.stdout
}

const errors = JSON.parse(stdout).flatMap((r) => r.messages.filter((m) => m.severity === 2))
const pendingPath = path.join(os.tmpdir(), `agy-lint-${input.conversationId || 'default'}.json`)

if (errors.length === 0) {
  if (input.toolCall) {
    if (existsSync(pendingPath)) {
      try {
        const pending = JSON.parse(readFileSync(pendingPath, 'utf8'))
        delete pending[rel]
        if (Object.keys(pending).length === 0) unlinkSync(pendingPath)
        else writeFileSync(pendingPath, JSON.stringify(pending), 'utf8')
      } catch {
        // Ignore temp file cleanup errors
      }
    }
    process.stdout.write('{}')
  }
  process.exit(0)
}

const lines = errors.slice(0, 20).map((m) => `${rel}:${m.line}:${m.column} ${m.message} (${m.ruleId})`)
if (errors.length > 20) lines.push(`…還有 ${errors.length - 20} 個錯誤`)

if (input.toolCall) {
  try {
    const pending = existsSync(pendingPath) ? JSON.parse(readFileSync(pendingPath, 'utf8')) : {}
    pending[rel] = lines
    writeFileSync(pendingPath, JSON.stringify(pending), 'utf8')
  } catch {
    // Ignore temp file write errors
  }
  process.stderr.write(`eslint --fix 後仍有 ${errors.length} 個錯誤：\n${lines.join('\n')}\n`)
  process.stdout.write('{}')
  process.exit(0)
}

process.stdout.write(
  JSON.stringify({
    decision: 'block',
    reason: `eslint --fix 後仍有 ${errors.length} 個錯誤，請修正：\n${lines.join('\n')}`,
  })
)
