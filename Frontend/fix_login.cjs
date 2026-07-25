const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bftklevvcvsgzrvmyvlo.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdGtsZXZ2Y3ZzZ3pydm15dmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk0MDE5NywiZXhwIjoyMDk5NTE2MTk3fQ.Mg2Yt6brtcwfgZtimQBpWV8WaQptpv1StNVCyyGNpf0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkAndFix() {
  // List all users to see what exists
  const { data: users, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('List error:', listErr.message);
    return;
  }

  console.log('=== Existing users ===');
  users.users.forEach(u => {
    console.log(` - ${u.email} | confirmed: ${u.email_confirmed_at ? 'yes' : 'no'} | id: ${u.id}`);
  });

  // Find admin@ayush.com
  const ayush = users.users.find(u => u.email === 'admin@ayush.com');
  if (ayush) {
    console.log('\n✅ admin@ayush.com EXISTS — resetting password to Password123!');
    const { error: updateErr } = await supabase.auth.admin.updateUserById(ayush.id, {
      password: 'Password123!',
      email_confirm: true
    });
    if (updateErr) {
      console.error('Update error:', updateErr.message);
    } else {
      console.log('✅ Password reset! Now try logging in again.');
    }
  } else {
    console.log('\nℹ️  admin@ayush.com not found — creating...');
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'admin@ayush.com',
      password: 'Password123!',
      email_confirm: true,
      user_metadata: { full_name: 'Admin Cayush', role: 'Admin' }
    });
    if (error) {
      console.error('Create error:', JSON.stringify(error));
    } else {
      console.log('✅ Created! Email: admin@ayush.com | Password: Password123!');
    }
  }
}

checkAndFix();
