require('dotenv').config();
const SUPABASE_URL = 'https://bftklevvcvsgzrvmyvlo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE;

async function check() {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch(SUPABASE_URL + '/rest/v1/prescriptions?select=*,patients(full_name,patient_id),medicines(name,generic_name),profiles!doctor_id(full_name)', {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
  });
  console.log('Prescriptions Query:', res.status, await res.text());
}
check().catch(console.error);
