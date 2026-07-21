import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: '找不到上傳的檔案' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Ensure upload directory exists inside public folder
    const uploadDir = join(process.cwd(), 'public', 'uploads')
    try {
      await mkdir(uploadDir, { recursive: true })
    } catch (e) {
      // Ignore if dir exists
    }

    // Generate unique name to prevent collision
    const uniqueName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`
    const path = join(uploadDir, uniqueName)
    
    await writeFile(path, buffer)
    
    // Return relative url path accessible by browsers
    const url = `/uploads/${uniqueName}`
    
    return NextResponse.json({
      name: file.name,
      url,
      size: file.size
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '檔案上傳失敗' }, { status: 500 })
  }
}
