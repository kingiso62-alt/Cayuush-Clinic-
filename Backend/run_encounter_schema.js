const fs = require('fs');

const SUPABASE_URL = 'https://bftklevvcvsgzrvmyvlo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdGtsZXZ2Y3ZzZ3pydm15dmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk0MDE5NywiZXhwIjoyMDk5NTE2MTk3fQ.Mg2Yt6brtcwfgZtimQBpWV8WaQptpv1StNVCyyGNpf0';

async function executeSql() {
  const sql = fs.readFileSync('../Frontend/encounter_schema.sql', 'utf8');
  console.log('Executing EMR Schema migrations...');

  let res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    },
    body: JSON.stringify({ sql })
  });

  if (!res.ok) {
    console.log('exec_sql failed, trying pg_query...');
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pg_query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ query: sql })
    });
  }

  const text = await res.text();
  console.log('Result Status:', res.status);
  console.log('Result Body:', text);
}

executeSql().catch(console.error);
