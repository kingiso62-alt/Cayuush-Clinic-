require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://bftklevvcvsgzrvmyvlo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE;

async function check() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: p } = await supabase.from('patients').select('id').limit(1);
  const { data: d } = await supabase.from('profiles').select('id').eq('role', 'Doctor').limit(1);
  const { data: m } = await supabase.from('medicines').select('id').limit(1);
  
  if (p[0] && d[0] && m[0]) {
    const { error } = await supabase.from('prescriptions').insert([{
      patient_id: p[0].id,
      doctor_id: d[0].id,
      medicine_id: m[0].id,
      dosage: '1 tablet',
      duration: '3 days',
      status: 'Pending',
    }]);
    console.log('Insert Error:', error);
  }
}
check().catch(console.error);
