const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bftklevvcvsgzrvmyvlo.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdGtsZXZ2Y3ZzZ3pydm15dmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk0MDE5NywiZXhwIjoyMDk5NTE2MTk3fQ.Mg2Yt6brtcwfgZtimQBpWV8WaQptpv1StNVCyyGNpf0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createAdminUser() {
  console.log('Creating admin@ayush.com user...');

  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@ayush.com',
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { full_name: 'Admin', role: 'Admin' }
  });

  if (error) {
    if (error.message.includes('already been registered') || error.message.includes('already exists')) {
      console.log('✅ User admin@ayush.com already exists — try logging in again.');
    } else {
      console.error('❌ Error:', error.message);
    }
  } else {
    console.log('✅ Created admin@ayush.com successfully!');
    console.log('   Email:    admin@ayush.com');
    console.log('   Password: Password123!');
    console.log('   Role:     Admin');

    // Also upsert profile
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      email: 'admin@ayush.com',
      full_name: 'Admin',
      role: 'Admin',
      is_active: true
    }, { onConflict: 'id' });

    if (profileError) {
      console.log('⚠️  Profile upsert:', profileError.message);
    } else {
      console.log('✅ Profile created!');
    }
  }
}

createAdminUser();
