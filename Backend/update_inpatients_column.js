const { Client } = require('pg');

const clientConfig = {
  host: 'aws-0-eu-west-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.bftklevvcvsgzrvmyvlo',
  password: 'Cayuush2026',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function update() {
  const client = new Client(clientConfig);
  try {
    await client.connect();
    console.log('Adding bed_id column to inpatients table if not exists...');
    await client.query(`
      ALTER TABLE public.inpatients 
      ADD COLUMN IF NOT EXISTS bed_id UUID REFERENCES public.beds(id) ON DELETE SET NULL;
      
      ALTER TABLE public.inpatients 
      ADD COLUMN IF NOT EXISTS total_charge NUMERIC DEFAULT 0.00;
    `);
    console.log('Successfully updated inpatients schema!');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

update();
