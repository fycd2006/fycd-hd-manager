import { NextResponse } from 'next/server'

export interface RolePermissions {
  readRow: boolean;
  createRow: boolean;
  updateRow: boolean;
  deleteRow: boolean;
}

const defaultPermissions: Record<string, RolePermissions> = {
  admin: { readRow: true, createRow: true, updateRow: true, deleteRow: true },
  member: { readRow: true, createRow: true, updateRow: true, deleteRow: true },
  viewer: { readRow: true, createRow: false, updateRow: false, deleteRow: false }
}

// Mock Prisma
const mockPrisma = {
  tablePermission: {
    findUnique: async ({ where }: any) => {
      if (where.tableId_userId.tableId === 10 && where.tableId_userId.userId === 99) {
        return { canRead: true, canUpdate: false, canCreate: false, canDelete: false }; // Read-only for this user on table 10
      }
      return null;
    }
  },
  fieldVisibility: {
    findMany: async ({ where }: any) => {
      if (where.fieldId.in.includes(101) && where.userId === 99) {
        return [{ fieldId: 101, canRead: false }]; // Hidden field 101 for user 99
      }
      return [];
    }
  }
}

export async function authorizeAction(
  options: { tableId?: number; action: keyof RolePermissions },
  userId: number,
  wsRole: string
) {
  let hasPermission = defaultPermissions[wsRole][options.action];

  if (options.tableId) {
    const tablePerm = await mockPrisma.tablePermission.findUnique({
      where: { tableId_userId: { tableId: options.tableId, userId } }
    });
    
    if (tablePerm) {
      // Override based on specific action
      switch (options.action) {
        case 'readRow': hasPermission = tablePerm.canRead; break;
        case 'updateRow': hasPermission = tablePerm.canUpdate; break;
        case 'createRow': hasPermission = tablePerm.canCreate; break;
        case 'deleteRow': hasPermission = tablePerm.canDelete; break;
      }
    }
  }

  if (!hasPermission) {
    throw new Error(`Access Denied to action ${options.action}`);
  }
  return true;
}

export async function filterFields(fields: any[], userId: number) {
  const fieldIds = fields.map(f => f.id);
  const hidden = await mockPrisma.fieldVisibility.findMany({
    where: { fieldId: { in: fieldIds }, userId }
  });
  const hiddenIds = new Set(hidden.filter(h => !h.canRead).map(h => h.fieldId));
  return fields.filter(f => !hiddenIds.has(f.id));
}

// --- Tests ---
async function runTests() {
  console.log("Running tests...");
  const wsRole = 'member'; // Default has full access
  const userId = 99;

  // Test 1: Table Read-Only Override
  let passed = false;
  try {
    await authorizeAction({ tableId: 10, action: 'updateRow' }, userId, wsRole);
  } catch (e: any) {
    if (e.message.includes("Access Denied")) passed = true;
  }
  console.log("Test 1 (Read-Only Table prevents update):", passed ? "PASS" : "FAIL");

  // Test 2: Field Hidden Override
  const fields = [{ id: 100, name: 'Title' }, { id: 101, name: 'SecretSalary' }];
  const visible = await filterFields(fields, userId);
  console.log("Test 2 (Hidden field is removed):", visible.length === 1 && visible[0].id === 100 ? "PASS" : "FAIL");

  // Test 3: Unaffected Table
  const normalTableUpdate = await authorizeAction({ tableId: 20, action: 'updateRow' }, userId, wsRole);
  console.log("Test 3 (Normal table unaffected):", normalTableUpdate ? "PASS" : "FAIL");
}

runTests();
