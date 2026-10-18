import fs from 'fs'
import path from 'path'

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')

const files = {
  dashboard: read('dashboard/WorkspaceDashboard.tsx'),
  sidebar: read('sidebar/Sidebar.tsx'),
}

describe('brand consistency of main screen', () => {
  it.each(Object.entries(files))('%s no longer uses legacy brand assets', (_name, source) => {
    for (const legacy of ['logo.png', '#059669', '#10b981', 'from-blue-600', '#7c3aed', '#bef264']) {
      expect(source).not.toContain(legacy)
    }
  })

  it.each(Object.entries(files))('%s renders the FycdLogo', (_name, source) => {
    expect(source).toContain("from '@/components/brand/FycdLogo'")
    expect(source).toContain('<FycdLogo')
  })
})
