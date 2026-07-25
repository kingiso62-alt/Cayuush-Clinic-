const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const clientConfig = {
  host: 'aws-0-eu-west-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.bftklevvcvsgzrvmyvlo',
  password: 'Cayuush2026',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function executeSqlFile(filePath) {
  const absolutePath = path.resolve(filePath);
  console.log(`Reading SQL file: ${absolutePath}`);
  const sql = fs.readFileSync(absolutePath, 'utf8');

  const client = new Client(clientConfig);

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database.');
    await client.query(sql);
    console.log('SQL commands executed successfully!');
  } catch (err) {
    console.error('Error executing SQL:', err);
  } finally {
    await client.end();
  }
}

const targetFile = process.argv[2];
if (!targetFile) {
  console.error('Usage: node run_sql_pg.js <path_to_sql_file>');
  process.exit(1);
}

executeSqlFile(targetFile);
