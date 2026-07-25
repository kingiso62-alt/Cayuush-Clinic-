const SUPABASE_URL = 'https://bftklevvcvsgzrvmyvlo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdGtsZXZ2Y3ZzZ3pydm15dmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk0MDE5NywiZXhwIjoyMDk5NTE2MTk3fQ.Mg2Yt6brtcwfgZtimQBpWV8WaQptpv1StNVCyyGNpf0';

const sql = `
-- Disable RLS to allow all operations if that's the project's default, 
-- or add a permissive policy just in case.
ALTER TABLE public.inpatients DISABLE ROW LEVEL SECURITY;

-- If RLS is required to be enabled, we can create a policy:
-- ALTER TABLE public.inpatients ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Enable ALL for authenticated users" ON public.inpatients;
-- CREATE POLICY "Enable ALL for authenticated users" ON public.inpatients FOR ALL TO authenticated USING (true) WITH CHECK (true);
`;

async function executeSql() {
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
  console.log('Result:', res.status, text);
}

executeSql().catch(console.error);
