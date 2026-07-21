import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET: 獲取所有設備/器材 (包含所屬專案)
export async function GET() {
  try {
    const equipments = await prisma.equipment.findMany({
      include: {
        project: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(equipments)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '查詢設備失敗' }, { status: 500 })
  }
}

// POST: 新增設備/器材
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, category, serialNumber, status, projectId } = body

    if (!name || !category || !serialNumber) {
      return NextResponse.json({ error: '設備名稱、分類與序號為必填欄位' }, { status: 400 })
    }

    const newEquipment = await prisma.equipment.create({
      data: {
        name,
        category,
        serialNumber,
        status: status || 'available',
        projectId: projectId ? parseInt(projectId) : null,
      },
    })
    return NextResponse.json(newEquipment, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: '該設備序號/編號已存在' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || '新增設備失敗' }, { status: 500 })
  }
}
