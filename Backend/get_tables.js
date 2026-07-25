const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

try {
  const env = fs.readFileSync('.env', 'utf8');
  const url = env.match(/SUPABASE_URL\s*=\s*(.*)/)[1].trim().replace(/^['"`]|['"`]$/g, '');
  const key = env.match(/SUPABASE_SERVICE_ROLE\s*=\s*(.*)/)[1].trim().replace(/^['"`]|['"`]$/g, '');

  const supabase = createClient(url, key);
  
  supabase.rpc('exec_sql', { sql: `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `}).then(({ data, error }) => {
    if (error) {
      console.log('rpc exec_sql failed, trying profiles fetch...');
      supabase.from('profiles').select('id').limit(1).then(r => {
        console.log('connection works, profiles exists.');
      });
    } else {
      console.log('Tables in database:', data);
    }
  });
} catch (e) {
  console.error(e);
}
