import prisma from '../src/lib/prisma'

async function main() {
  console.log('=== 測試 1: TiDB CAST 非法字串 (髒資料 "N/A", "invalid") 的行為 ===')
  try {
    const dirtyResult = await prisma.$queryRaw<any[]>`
      SELECT 
        CAST(NULLIF('123.45', '') AS DECIMAL(30,10)) AS valid_num,
        CAST(NULLIF('N/A', '') AS DECIMAL(30,10)) AS invalid_str
    `
    console.log('TiDB CAST dirty string result:', dirtyResult)
  } catch (err: any) {
    console.error('❌ TiDB CAST dirty string 拋出錯誤:', err.message)
  }

  console.log('\n=== 測試 2: TiDB 正則運算式或安全轉型防護 ===')
  try {
    // 測試用 REGEXP 篩選是否為合法浮點數/整數
    // 符合: '123', '-123', '123.45', '-123.45', '.5'
    // 不符合: 'N/A', 'abc', '$100', ''
    const safeRegexResult = await prisma.$queryRaw<any[]>`
      SELECT 
        CASE 
          WHEN '123.45' REGEXP '^-?[0-9]*\\.?[0-9]+$' THEN CAST('123.45' AS DECIMAL(30,10))
          ELSE NULL 
        END AS valid_safe,
        CASE 
          WHEN 'N/A' REGEXP '^-?[0-9]*\\.?[0-9]+$' THEN CAST('N/A' AS DECIMAL(30,10))
          ELSE NULL 
        END AS dirty_safe_1,
        CASE 
          WHEN '$99.9' REGEXP '^-?[0-9]*\\.?[0-9]+$' THEN CAST('$99.9' AS DECIMAL(30,10))
          ELSE NULL 
        END AS dirty_safe_2,
        CASE 
          WHEN '' REGEXP '^-?[0-9]*\\.?[0-9]+$' THEN CAST('' AS DECIMAL(30,10))
          ELSE NULL 
        END AS empty_safe
    `
    console.log('TiDB Safe Regex CAST result:', safeRegexResult)
  } catch (err: any) {
    console.error('❌ Safe Regex 測試失敗:', err.message)
  }

  await prisma.$disconnect()
}

main().catch(console.error)
