const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

try {
  const env = fs.readFileSync('.env', 'utf8');
  const url = env.match(/SUPABASE_URL\s*=\s*(.*)/)[1].trim().replace(/^['"`]|['"`]$/g, '');
  const key = env.match(/SUPABASE_SERVICE_ROLE\s*=\s*(.*)/)[1].trim().replace(/^['"`]|['"`]$/g, '');

  const supabase = createClient(url, key);
  
  // Use auth.admin api to list users from Supabase Auth
  supabase.auth.admin.listUsers().then(({ data, error }) => {
    if (error) {
      console.error('Error fetching auth users:', error);
    } else {
      console.log('Registered Auth Users:');
      data.users.forEach(u => {
        console.log(`- Email: ${u.email}, CreatedAt: ${u.created_at}`);
      });
    }
  });
} catch (e) {
  console.error('Script failed:', e);
}
