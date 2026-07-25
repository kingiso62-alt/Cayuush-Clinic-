const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bftklevvcvsgzrvmyvlo.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdGtsZXZ2Y3ZzZ3pydm15dmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk0MDE5NywiZXhwIjoyMDk5NTE2MTk3fQ.Mg2Yt6brtcwfgZtimQBpWV8WaQptpv1StNVCyyGNpf0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createAdmin() {
  console.log('Creating admin user...');
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@cayush.com',
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { full_name: 'Dr. Aisho Ibrahim', role: 'Admin' }
  });

  if (error) {
    if (error.message.includes('already been registered')) {
        console.log('Admin user already exists!');
    } else {
        console.error('Error creating admin user:', error.message);
    }
  } else {
    console.log('Successfully created admin user:', data.user?.email);
  }
}

createAdmin();
