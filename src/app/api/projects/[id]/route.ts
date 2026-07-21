import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// PATCH: 更新特定專案
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const projectId = parseInt(id)
    if (isNaN(projectId)) {
      return NextResponse.json({ error: '無效的 ID' }, { status: 400 })
    }

    const body = await request.json()
    const { name, description, status } = body

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
      },
    })
    return NextResponse.json(updatedProject)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '更新專案失敗' }, { status: 500 })
  }
}

// DELETE: 刪除特定專案 (先將底下綁定的設備設為 null，以免關聯錯誤)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const projectId = parseInt(id)
    if (isNaN(projectId)) {
      return NextResponse.json({ error: '無效的 ID' }, { status: 400 })
    }

    // 將綁定此專案的設備的 projectId 設為 null
    await prisma.equipment.updateMany({
      where: { projectId: projectId },
      data: { projectId: null },
    })

    // 刪除專案
    await prisma.project.delete({
      where: { id: projectId },
    })
    return NextResponse.json({ message: '專案已成功刪除' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '刪除專案失敗' }, { status: 500 })
  }
}
