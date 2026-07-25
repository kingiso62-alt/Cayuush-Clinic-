const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bftklevvcvsgzrvmyvlo.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdGtsZXZ2Y3ZzZ3pydm15dmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk0MDE5NywiZXhwIjoyMDk5NTE2MTk3fQ.Mg2Yt6brtcwfgZtimQBpWV8WaQptpv1StNVCyyGNpf0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixProfiles() {
  console.log('Fetching users...');
  const { data: { users }, error: fetchError } = await supabase.auth.admin.listUsers();
  
  if (fetchError) {
    console.error('Error fetching users:', fetchError);
    return;
  }

  console.log(`Found ${users.length} users. Syncing to profiles...`);

  for (const user of users) {
    const { error: insertError } = await supabase.from('profiles').insert([
      {
        id: user.id,
        full_name: user.user_metadata?.full_name || 'Admin User',
        email: user.email,
        role: user.user_metadata?.role || 'Admin'
      }
    ]);

    if (insertError) {
      if (insertError.code === '23505') {
        console.log(`Profile for ${user.email} already exists.`);
      } else {
        console.error(`Error inserting profile for ${user.email}:`, insertError.message);
      }
    } else {
      console.log(`Successfully created profile for ${user.email}`);
    }
  }
}

fixProfiles();
