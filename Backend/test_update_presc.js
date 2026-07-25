require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://bftklevvcvsgzrvmyvlo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE;

async function check() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: p } = await supabase.from('prescriptions').select('id').limit(1);
  if (p && p.length > 0) {
    const { error } = await supabase.from('prescriptions').update({
      status: 'Dispensed', dispensed_by: 'b33ca827-04c9-4b20-bafe-5b72e505cf4c', dispensed_at: new Date().toISOString()
    }).eq('id', p[0].id);
    console.log('Update Error:', error);
  }
}
check().catch(console.error);
