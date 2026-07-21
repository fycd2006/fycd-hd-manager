import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET: 獲取所有專案
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        _count: {
          select: { equipments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(projects)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '查詢專案失敗' }, { status: 500 })
  }
}

// POST: 新增專案
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, status } = body

    if (!name) {
      return NextResponse.json({ error: '專案名稱為必填欄位' }, { status: 400 })
    }

    const newProject = await prisma.project.create({
      data: {
        name,
        description,
        status: status || 'active',
      },
    })
    return NextResponse.json(newProject, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '新增專案失敗' }, { status: 500 })
  }
}
