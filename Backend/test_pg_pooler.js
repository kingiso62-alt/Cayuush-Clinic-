const { Client } = require('pg');

const regions = [
  'us-east-1',
  'us-west-1',
  'us-west-2',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ca-central-1',
  'sa-east-1'
];

async function probe() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    console.log(`Probing region: ${region} (${host})...`);
    const client = new Client({
      host,
      port: 6543,
      user: 'postgres.bftklevvcvsgzrvmyvlo',
      password: 'Cayuush2026',
      database: 'postgres',
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log(`🎉 SUCCESS! Connected to region: ${region}`);
      const res = await client.query('SELECT NOW()');
      console.log('Server time:', res.rows[0]);
      await client.end();
      return host; // Found it!
    } catch (err) {
      if (err.message.includes('tenant/user') && err.message.includes('not found')) {
        console.log(`   User not found in region ${region}.`);
      } else {
        console.log(`   Connection error in region ${region}:`, err.message);
      }
    } finally {
      try {
        await client.end();
      } catch (e) {}
    }
  }
  console.log('Could not find the region.');
  return null;
}

probe();
