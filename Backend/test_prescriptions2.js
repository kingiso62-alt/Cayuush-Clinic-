require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://bftklevvcvsgzrvmyvlo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE;

async function check() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await supabase
    .from('prescriptions')
    .select('*, patients(full_name, patient_id), medicines(name, generic_name), profiles!doctor_id(full_name)')
    .order('created_at', { ascending: false });
  console.log('Error:', error);
  console.log('Data count:', data ? data.length : 0);
}
check().catch(console.error);
