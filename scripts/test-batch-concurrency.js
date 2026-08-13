const http = require('http');
const https = require('https');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch { }
        resolve({ status: res.statusCode, body, parsed });
      });
    });
    req.on('error', (err) => resolve({ error: err.message }));
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function runBatchBenchmark() {
  console.log(`[Setup] Target Base URL: ${BASE_URL}`);
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.TEST_COOKIE) {
    headers['Cookie'] = process.env.TEST_COOKIE;
  }

  const tablesRes = await fetchUrl(`${BASE_URL}/api/tables?page=1&pageSize=1`, { headers });
  const tables = tablesRes.parsed?.tables || tablesRes.parsed;

  if (!tables || tables.length === 0) {
    console.error('No tables found to test against! Response:', tablesRes.body);
    return;
  }
  const tableId = tables[0].id;
  console.log(`[Setup] Target table found: ID ${tableId} ("${tables[0].name}")`);

  let rowsRes = await fetchUrl(`${BASE_URL}/api/tables/${tableId}/rows?page=1&pageSize=100`, { headers });
  let rows = Array.isArray(rowsRes.parsed) ? rowsRes.parsed : (rowsRes.parsed?.rows || []);

  if (rows.length < 100) {
    console.log(`[Setup] Only ${rows.length} rows found. Creating ${100 - rows.length} more rows for testing...`);
    for (let i = rows.length; i < 100; i += 10) {
      const batch = [];
      for (let j = i; j < Math.min(i + 10, 100); j++) {
        batch.push(fetchUrl(`${BASE_URL}/api/tables/${tableId}/rows`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ data: { field_1: `Init_${j}` } })
        }));
      }
      await Promise.all(batch);
    }
    rowsRes = await fetchUrl(`${BASE_URL}/api/tables/${tableId}/rows?page=1&pageSize=100`, { headers });
    rows = Array.isArray(rowsRes.parsed) ? rowsRes.parsed : (rowsRes.parsed?.rows || []);
  }

  if (rows.length < 100) {
    console.error('Failed to create enough rows for batch benchmark!');
    return;
  }

  console.log(`[Setup] Target table has ${rows.length} rows. Preparing 10 concurrent Batch PATCH requests (10 updates per batch)...`);

  const startTime = Date.now();
  const reqPromises = Array.from({ length: 10 }).map((_, batchIdx) => {
    // 刻意更新同一批 row (rows 0-9)，測試 Row Lock 競爭
    const updates = rows.slice(0, 10).map((r, idx) => ({
      rowId: r.id,
      data: { field_1: `Row_${idx}_${Date.now()}_req${batchIdx}` }
    }));

    const bodyStr = JSON.stringify({ updates });
    const reqStart = Date.now();
    return fetchUrl(`${BASE_URL}/api/tables/${tableId}/rows/batch`, {
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      },
      body: bodyStr
    }).then(res => ({
      status: res.status,
      duration: Date.now() - reqStart,
      error: res.parsed?.error
    }));
  });

  const results = await Promise.all(reqPromises);
  const totalWallTime = Date.now() - startTime;

  const durations = results.map(r => r.duration).sort((a, b) => a - b);
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const sum = durations.reduce((acc, d) => acc + d, 0);
  const avg = Math.round(sum / durations.length);
  const successCount = results.filter(r => r.status === 200).length;

  console.log(`\n=== Batch PATCH Concurrency Benchmark Results ===`);
  console.log(`Total Batch Requests: ${results.length}`);
  console.log(`HTTP 200 Successes: ${successCount}/${results.length}`);
  console.log(`Total Wall Clock Time: ${totalWallTime} ms`);
  console.log(`Individual Batch Latencies:`);
  console.log(` - Min: ${min} ms`);
  console.log(` - Max: ${max} ms`);
  console.log(` - Avg: ${avg} ms`);
  console.log(` - Durations Breakdown: ${durations.join(', ')} ms`);
}

runBatchBenchmark().catch(console.error);
