const { Client } = require('pg');

const dbUrl = "postgresql://neondb_owner:npg_i1KGeVJ7Phra@ep-twilight-moon-aoav7nin.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  console.log("Connecting to Neon Postgres to inspect locks...");
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    
    // 1. Get our own PID
    const pidRes = await client.query("SELECT pg_backend_pid();");
    const myPid = pidRes.rows[0].pg_backend_pid;
    
    // 2. Query active advisory locks
    const locksRes = await client.query(`
      SELECT pid, classid, objid, objsubid, granted 
      FROM pg_locks 
      WHERE locktype = 'advisory';
    `);
    
    const locks = locksRes.rows;
    if (locks.length === 0) {
      console.log("No active advisory locks found. The database is clear.");
      await client.end();
      return;
    }
    
    console.log(`Found ${locks.length} active advisory lock(s):`);
    for (const lock of locks) {
      const pid = lock.pid;
      console.log(`  PID: ${pid}, ClassID: ${lock.classid}, ObjID: ${lock.objid}, Granted: ${lock.granted}`);
      
      if (pid !== myPid) {
        console.log(`Terminating orphaned backend session (PID ${pid}) holding the lock...`);
        const killRes = await client.query("SELECT pg_terminate_backend($1);", [pid]);
        console.log(`  Termination status: ${killRes.rows[0].pg_terminate_backend}`);
      }
    }
    
    await client.end();
  } catch (e) {
    console.error("Database error:", e);
    process.exit(1);
  }
}

main();
