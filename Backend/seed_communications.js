const { Client } = require('pg');

const clientConfig = {
  host: 'aws-0-eu-west-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.bftklevvcvsgzrvmyvlo',
  password: 'Cayuush2026',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function seed() {
  const client = new Client(clientConfig);
  try {
    await client.connect();
    console.log('Seeding communications log data...');
    
    // Clear old ones
    await client.query('DELETE FROM public.communications');
    
    const pRes = await client.query('SELECT id, full_name, phone FROM patients LIMIT 3');
    if (pRes.rows.length === 0) {
      console.log('No patients found to link. Seeding raw logs instead.');
      await client.query(`
        INSERT INTO public.communications (recipient_name, recipient_phone, channel, message_type, message_content, status)
        VALUES 
        ('Amina Abdi', '+252 61 9639994', 'WhatsApp', 'Appointment', 'Ku: Amina Abdi, Ballantaada dhakhtarka ee 26-07-2026 09:00 Subaxnimo waa la xaqiijiyey. Mahadsanid.', 'Sent'),
        ('Farah Ali', '+252 61 5554321', 'SMS', 'Invoice', 'Ku: Farah Ali, Waxaa kuu soo baxay Invoice cusub oo ah $45.00. Fadlan ku bixi xafiiska lacagta. Cayush Clinic.', 'Sent'),
        ('Khadra Omar', '+252 61 7778899', 'WhatsApp', 'Lab Result', 'Ku: Khadra Omar, Natiijada baaritaankaaga shaybaarka (Malaria Test) waa diyaar. Fadlan booqo portal-ka si aad u aragto.', 'Sent')
      `);
    } else {
      const p1 = pRes.rows[0];
      const p2 = pRes.rows[1] || p1;
      const p3 = pRes.rows[2] || p1;
      
      await client.query(`
        INSERT INTO public.communications (patient_id, recipient_name, recipient_phone, channel, message_type, message_content, status)
        VALUES 
        ('${p1.id}', '${p1.full_name}', '${p1.phone || '+252 61 9639994'}', 'WhatsApp', 'Appointment', 'Ku: ${p1.full_name}, Ballantaada dhakhtarka ee 26-07-2026 10:00 waa la xaqiijiyey. Mahadsanid.', 'Sent'),
        ('${p2.id}', '${p2.full_name}', '${p2.phone || '+252 61 5554321'}', 'SMS', 'Invoice', 'Ku: ${p2.full_name}, Waxaa kuu soo baxay Invoice cusub oo ah $65.00. Fadlan ku bixi xafiiska lacagta. Cayush Clinic.', 'Sent'),
        ('${p3.id}', '${p3.full_name}', '${p3.phone || '+252 61 7778899'}', 'WhatsApp', 'Lab Result', 'Ku: ${p3.full_name}, Natiijada baaritaankaaga shaybaarka waa diyaar. Fadlan booqo portal-ka si aad u aragto.', 'Sent')
      `);
    }
    console.log('Seeded communications table successfully!');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

seed();
