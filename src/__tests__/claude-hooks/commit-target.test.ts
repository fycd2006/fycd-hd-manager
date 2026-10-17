import path from 'node:path'
import { isGitCommit, resolveCommitDir } from '../../../.claude/hooks/commit-target.cjs'

const cwd = path.resolve('/repo/main')
const other = path.resolve('/repo/review')

describe('isGitCommit', () => {
  it.each([
    'git commit -m "x"',
    'git -C /repo/review commit -m x',
    'cd /repo/review && git commit -m x',
    'git -c user.name=a --no-pager commit',
  ])('偵測 commit：%s', (command) => {
    expect(isGitCommit(command)).toBe(true)
  })

  it.each(['git status', 'npm test', 'git log --grep commit', 'echo commit'])('非 commit：%s', (command) => {
    expect(isGitCommit(command)).toBe(false)
  })
})

describe('resolveCommitDir', () => {
  it('git commit 用 hook 輸入的 cwd', () => {
    expect(resolveCommitDir('git commit -m x', cwd)).toBe(cwd)
  })

  it('git -C <dir> commit 用 -C 指定的目錄', () => {
    expect(resolveCommitDir(`git -C ${other} commit -m x`, cwd)).toBe(other)
  })

  it('git -C 帶引號與相對路徑時相對 cwd 解析', () => {
    expect(resolveCommitDir('git -C "../review" commit -m x', cwd)).toBe(other)
  })

  it('多個 -C 依序疊加', () => {
    expect(resolveCommitDir('git -C /repo -C review commit', cwd)).toBe(other)
  })

  it('cd <dir> && git commit 用 cd 後的目錄', () => {
    expect(resolveCommitDir(`cd ${other} && git commit -m x`, cwd)).toBe(other)
  })

  it('cd 與 -C 同時出現時 -C 相對 cd 後的目錄', () => {
    expect(resolveCommitDir("cd '/repo' ; git -C review commit", cwd)).toBe(other)
  })

  it('Windows 路徑的 -C', () => {
    expect(resolveCommitDir('git -C "C:\\dev\\fycd-hd-manager-review" commit', cwd)).toBe(
      path.resolve(cwd, 'C:\\dev\\fycd-hd-manager-review'),
    )
  })

  it('非 commit 指令回傳 null', () => {
    expect(resolveCommitDir('cd /repo/review && git status', cwd)).toBeNull()
  })
})
