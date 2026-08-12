const http = require('http');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body || '[]') }));
    }).on('error', reject);
  });
}

function httpPatchBatchWithTiming(url, payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);
    const startTime = Date.now();
    const req = http.request(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        let parsed = {};
        try { parsed = JSON.parse(body); } catch {}
        resolve({ status: res.statusCode, duration, count: parsed.updates?.length || 0, error: parsed.error });
      });
    });
    req.on('error', (err) => resolve({ error: err.message, duration: Date.now() - startTime }));
    req.write(data);
    req.end();
  });
}

async function runBatchBenchmark() {
  const tableId = 300004;
  console.log(`[Setup] Fetching rows for table ${tableId}...`);
  const rowsRes = await httpGet(`http://localhost:3000/api/tables/${tableId}/rows?page=1&pageSize=20`);
  const rows = Array.isArray(rowsRes.data) ? rowsRes.data : (rowsRes.data.rows || []);
  
  if (rows.length === 0) {
    console.error('No rows found in target table for batch benchmark!');
    return;
  }

  console.log(`[Setup] Target table has ${rows.length} rows. Preparing 10 concurrent Batch PATCH requests (10 updates per batch)...`);

  const startTime = Date.now();
  const reqPromises = Array.from({ length: 10 }).map((_, batchIdx) => {
    const updates = rows.slice(0, 10).map((r, rIdx) => ({
      rowId: r.id,
      data: { field_1: `Batch_${batchIdx + 1}_Row_${rIdx + 1}_${Date.now()}` }
    }));

    return httpPatchBatchWithTiming(`http://localhost:3000/api/tables/${tableId}/rows/batch`, { updates });
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
