import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// PATCH: 更新特定設備 (包括綁定/解綁專案)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const equipmentId = parseInt(id)
    if (isNaN(equipmentId)) {
      return NextResponse.json({ error: '無效的 ID' }, { status: 400 })
    }

    const body = await request.json()
    const { name, category, serialNumber, status, projectId } = body

    // 處理 projectId 的綁定與解綁
    let formattedProjectId = undefined
    if (projectId !== undefined) {
      formattedProjectId = projectId === null || projectId === "" ? null : parseInt(projectId)
    }

    const updatedEquipment = await prisma.equipment.update({
      where: { id: equipmentId },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(serialNumber && { serialNumber }),
        ...(status && { status }),
        ...(projectId !== undefined && { projectId: formattedProjectId }),
      },
    })
    return NextResponse.json(updatedEquipment)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: '該設備序號/編號已存在' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || '更新設備失敗' }, { status: 500 })
  }
}

// DELETE: 刪除特定設備
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const equipmentId = parseInt(id)
    if (isNaN(equipmentId)) {
      return NextResponse.json({ error: '無效的 ID' }, { status: 400 })
    }

    await prisma.equipment.delete({
      where: { id: equipmentId },
    })
    return NextResponse.json({ message: '設備已成功刪除' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '刪除設備失敗' }, { status: 500 })
  }
}
