// PreToolUse (git commit / dangerous build):
// 1. Blocks `npm run build` and `prisma db push --accept-data-loss`.
// 2. Serializes and runs `npm run verify` in the worktree being committed before allowing `git commit`.
// Supports both Claude Code (exit 2 + stderr) and Antigravity (stdout JSON decision: deny/ask).
import { execFileSync, execSync } from 'node:child_process'
import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isDangerousBuildOrPush, resolveCommitDir } from './commit-target.cjs'

let input = {}
try {
  const raw = readFileSync(0, 'utf8').trim()
  if (raw) input = JSON.parse(raw)
} catch {
  process.exit(0)
}

const isAgy = Boolean(input.toolCall)
const allow = () => {
  if (isAgy) process.stdout.write(JSON.stringify({ decision: 'ask' }))
  process.exit(0)
}
const deny = (reason) => {
  if (isAgy) {
    process.stdout.write(JSON.stringify({ decision: 'deny', reason }))
    process.exit(0)
  }
  process.stderr.write(`${reason}\n`)
  process.exit(2)
}

const command = input.tool_input?.command ?? input.toolCall?.args?.CommandLine ?? ''
if (isDangerousBuildOrPush(command)) {
  deny('嚴禁執行 npm run build 或 prisma db push --accept-data-loss（可能抹除遠端／本機資料庫）！編譯檢查請改用 npm run build:check。')
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
  // Not a git directory (or the path could not be parsed): keep verifying the hook's own checkout.
}

if (!existsSync(path.join(root, 'node_modules'))) {
  deny(`${root} 沒有 node_modules，無法在要 commit 的 worktree 跑 npm run verify，已阻擋 commit。先在該目錄執行 npm ci（不要用目錄連結共用 node_modules）。`)
}

// Serialize concurrent `npm run verify` runs across parallel worktrees so multiple Jest/Next builds
// do not thrash RAM and cause false 5000ms component test timeouts.
const lockPath = path.join(os.tmpdir(), 'fycd-pre-commit-verify.lock')
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const isPidAlive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

let acquired = false
const deadline = Date.now() + 600_000
while (Date.now() < deadline) {
  try {
    const fd = openSync(lockPath, 'wx')
    writeFileSync(fd, JSON.stringify({ pid: process.pid, time: Date.now() }), 'utf8')
    closeSync(fd)
    acquired = true
    break
  } catch {
    try {
      const holder = JSON.parse(readFileSync(lockPath, 'utf8'))
      if (!holder.pid || !isPidAlive(holder.pid) || Date.now() - holder.time > 600_000) {
        unlinkSync(lockPath)
        continue
      }
    } catch {
      // Lock file is being written or already removed; wait briefly.
    }
    sleepSync(1000)
  }
}

const releaseLock = () => {
  if (!acquired) return
  try {
    unlinkSync(lockPath)
  } catch {
    // Ignore cleanup errors
  }
}

try {
  execSync('npm run verify', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
} catch (err) {
  releaseLock()
  const out = `${err.stdout ?? ''}\n${err.stderr ?? ''}`.trim().split('\n')
  deny(`npm run verify 失敗（${root}），已阻擋 commit。修到通過後再 commit。\n${out.slice(-40).join('\n')}`)
}

releaseLock()
allow()
