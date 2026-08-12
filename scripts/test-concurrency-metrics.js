const http = require('http');

function httpPatchWithTiming(url, payload) {
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
        resolve({ status: res.statusCode, duration, body: body.substring(0, 100) });
      });
    });
    req.on('error', (err) => resolve({ error: err.message, duration: Date.now() - startTime }));
    req.write(data);
    req.end();
  });
}

async function runBenchmark() {
  const tableId = 300004;
  const targetRowId = 1199607;
  console.log(`Sending 10 concurrent PATCH requests...`);
  
  const startTime = Date.now();
  const reqPromises = Array.from({ length: 10 }).map((_, index) => {
    return httpPatchWithTiming(`http://localhost:3000/api/tables/${tableId}/rows`, {
      rowId: targetRowId,
      fieldKey: 'field_1',
      value: `Bench_Val_${index}_${Date.now()}`
    });
  });

  const results = await Promise.all(reqPromises);
  const totalWallTime = Date.now() - startTime;
  
  const durations = results.map(r => r.duration).sort((a, b) => a - b);
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const sum = durations.reduce((acc, d) => acc + d, 0);
  const avg = Math.round(sum / durations.length);
  const successCount = results.filter(r => r.status === 200).length;

  console.log(`=== Concurrency Benchmark Results ===`);
  console.log(`Total Requests: ${results.length}`);
  console.log(`Success Count (HTTP 200): ${successCount}`);
  console.log(`Total Wall Clock Time: ${totalWallTime}ms`);
  console.log(`Individual Request Latencies:`);
  console.log(` - Min: ${min}ms`);
  console.log(` - Max: ${max}ms`);
  console.log(` - Avg: ${avg}ms`);
  console.log(` - Durations Breakdown: ${durations.join(', ')} ms`);
}

runBenchmark().catch(console.error);
