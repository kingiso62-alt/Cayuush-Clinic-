const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

try {
  const env = fs.readFileSync('.env', 'utf8');
  const url = env.match(/SUPABASE_URL\s*=\s*(.*)/)[1].trim().replace(/^['"`]|['"`]$/g, '');
  const key = env.match(/SUPABASE_SERVICE_ROLE\s*=\s*(.*)/)[1].trim().replace(/^['"`]|['"`]$/g, '');

  const supabase = createClient(url, key);
  
  // Find user id by email
  supabase.auth.admin.listUsers().then(async ({ data, error }) => {
    if (error) {
      console.error(error);
    } else {
      const user = data.users.find(u => u.email === 'admin@ayush.com');
      if (user) {
        console.log(`Resetting password for ${user.email} (ID: ${user.id})...`);
        const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
          password: 'Password123!'
        });
        if (updateError) {
          console.error('Reset failed:', updateError);
        } else {
          console.log('Password successfully reset to: Password123!');
        }
      } else {
        console.log('Admin user not found!');
      }
    }
  });
} catch (e) {
  console.error(e);
}
