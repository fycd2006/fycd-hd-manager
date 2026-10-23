import { execFileSync, execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import commitTargetPkg from '../../.claude/hooks/commit-target.cjs'

const { resolveCommitDir, isDangerousBuildOrPush } = commitTargetPkg

const DANGEROUS_BUILD_RE =
  /(?:^|[;&|]\s*)\s*(?:npm(?:\.cmd)?\s+run|pnpm(?:\s+run)?|yarn(?:\s+run)?)\s+build(?![:\w-])|(?:^|[;&|]\s*)\s*(?:npx(?:\.cmd)?\s+)?prisma\s+db\s+push\b[^;&|]*--accept-data-loss\b/i

function checkDangerous(cmd) {
  if (typeof isDangerousBuildOrPush === 'function') return isDangerousBuildOrPush(cmd)
  return DANGEROUS_BUILD_RE.test(cmd)
}

function deny(reason) {
  process.stdout.write(JSON.stringify({
    decision: 'deny',
    reason
  }))
  process.exit(0)
}

function allow() {
  process.stdout.write(JSON.stringify({
    decision: 'allow'
  }))
  process.exit(0)
}

let input = {}
try {
  const raw = readFileSync(0, 'utf8').trim()
  if (raw) input = JSON.parse(raw)
} catch {
  process.exit(0)
}

const command = input.commandLine || input.tool_input?.command || input.toolCall?.args?.CommandLine || ''

if (checkDangerous(command)) {
  deny('攔截危險指令：本專案嚴禁執行 `npm run build` 或 `prisma db push --accept-data-loss`！檢查編譯請改用 `npm run build:check`。')
}

const hookRoot = path.resolve(import.meta.dirname, '..', '..')
const baseCwd = input.cwd || input.workspacePaths?.[0] || hookRoot
const dir = resolveCommitDir(command, baseCwd)
if (dir === null) allow()

if (!existsSync(dir)) {
  deny(`解析出的 commit 目錄 ${dir} 不存在，無法確認要驗證哪個 worktree，已阻擋 commit。改用 git -C <存在的絕對路徑> commit。`)
}

let root = hookRoot
try {
  root = path.resolve(execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim())
} catch {
  // Not a git directory
}

if (!existsSync(path.join(root, 'node_modules'))) {
  deny(`${root} 沒有 node_modules，無法在要 commit 的 worktree 跑 npm run verify，已阻擋 commit。先在該目錄執行 npm ci。`)
}

try {
  execSync('npm run verify', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
} catch (err) {
  const out = `${err.stdout ?? ''}\n${err.stderr ?? ''}`.trim().split('\n')
  deny(`npm run verify 失敗（${root}），已阻擋 commit。修到通過後再 commit。\n${out.slice(-40).join('\n')}`)
}

allow()
