const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

try {
  const env = fs.readFileSync('.env', 'utf8');
  const url = env.match(/SUPABASE_URL\s*=\s*(.*)/)[1].trim().replace(/^['"`]|['"`]$/g, '');
  const key = env.match(/SUPABASE_SERVICE_ROLE\s*=\s*(.*)/)[1].trim().replace(/^['"`]|['"`]$/g, '');

  const supabase = createClient(url, key);
  
  supabase.from('referrals').select('id').limit(1).then(({ data, error }) => {
    if (error) {
      console.log('Error querying referrals table:', error.message);
    } else {
      console.log('Success! referrals Table exists. Data count:', data.length);
    }
  });

  supabase.from('procedures').select('id').limit(1).then(({ data, error }) => {
    if (error) {
      console.log('Error querying procedures table:', error.message);
    } else {
      console.log('Success! procedures Table exists. Data count:', data.length);
    }
  });
} catch (e) {
  console.error(e);
}
