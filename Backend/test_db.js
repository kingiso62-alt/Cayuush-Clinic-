const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://bftklevvcvsgzrvmyvlo.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdGtsZXZ2Y3ZzZ3pydm15dmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk0MDE5NywiZXhwIjoyMDk5NTE2MTk3fQ.Mg2Yt6brtcwfgZtimQBpWV8WaQptpv1StNVCyyGNpf0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkTables() {
  console.log('Testing connection...');
  
  // Try querying patients
  const { data: patients, error: pError } = await supabase.from('patients').select('id').limit(1);
  console.log('Patients query result:', { hasPatients: !!patients, error: pError?.message });

  // Try querying inpatients
  const { data: inpatients, error: iError } = await supabase.from('inpatients').select('*').limit(1);
  console.log('Inpatients query result:', { hasInpatients: !!inpatients, errorCode: iError?.code, errorMessage: iError?.message });
}

checkTables();
