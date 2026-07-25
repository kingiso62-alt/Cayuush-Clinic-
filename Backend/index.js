require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ─────────────────────────────────────────────────────────────────────────────
// Run fix SQL via Supabase REST API at startup
// ─────────────────────────────────────────────────────────────────────────────
const FIX_TRIGGER_SQL = `
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id,
    COALESCE(NULLIF(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    COALESCE(NULLIF(new.raw_user_meta_data->>'role', '')::user_role, 'Receptionist'::user_role)
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    role      = COALESCE(EXCLUDED.role, public.profiles.role),
    email     = EXCLUDED.email;
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new; -- Never block user creation even if profile fails
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function fixTrigger() {
  try {
    // Use Supabase REST API to run SQL (no direct DB connection needed)
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ sql: FIX_TRIGGER_SQL })
    });

    if (res.ok) {
      console.log('✅ Trigger fixed successfully via REST API!');
      return true;
    }

    // Fallback: try pg_query RPC if exec_sql doesn't exist
    const res2 = await fetch(`${supabaseUrl}/rest/v1/rpc/pg_query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ query: FIX_TRIGGER_SQL })
    });

    if (res2.ok) {
      console.log('✅ Trigger fixed via pg_query RPC!');
      return true;
    }

    console.log('ℹ️  Auto-fix skipped — please run the trigger SQL once in Supabase SQL Editor.');
    console.log('ℹ️  App will still work normally for all other operations.');
    return false;
  } catch (err) {
    console.log('ℹ️  Auto-fix skipped (network):', err.message.substring(0, 60));
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'Cayush Clinic Backend running', port });
});

app.get('/api/patients', async (req, res) => {
  try {
    const { data, error } = await supabase.from('patients').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Staff Account
app.post('/api/staff', async (req, res) => {
  const { email, password, full_name, role, phone } = req.body;

  if (!email || !password || !full_name || !role) {
    return res.status(400).json({ error: 'Dhammaan fields-ka buux samee' });
  }

  try {
    // Check if user already exists
    const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const listData = await listRes.json();
    const exists = (listData.users || []).find(u => u.email === email);
    if (exists) {
      return res.status(400).json({ error: `Email-kan waa la isticmaali horaan: ${email}` });
    }

    // Clean up any orphaned profiles
    await supabase.from('profiles').delete().eq('email', email);

    // Create auth user
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name.trim(), role }
      })
    });

    const userData = await createRes.json();
    console.log('Create user:', createRes.status, userData?.email || JSON.stringify(userData));

    if (!createRes.ok) {
      const errMsg = userData.msg || userData.message || userData.error_description || JSON.stringify(userData);
      return res.status(400).json({ error: errMsg });
    }

    // Wait for trigger to fire
    await new Promise(r => setTimeout(r, 1000));

    // Upsert profile (handles trigger success OR failure)
    await supabase.from('profiles').upsert({
      id: userData.id,
      email,
      full_name: full_name.trim(),
      role,
      phone: phone || null,
      is_active: true
    }, { onConflict: 'id' });

    res.json({ success: true, message: 'Shaqaalaha si guul leh ayaa loo abuuray!', user: { id: userData.id, email: userData.email } });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete Staff Account
app.delete('/api/staff/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Delete from public.profiles first to test database constraint checks
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (profileError) {
      if (profileError.code === '23503') {
        return res.status(400).json({ 
          error: 'Koontadan shaqaalaha lama tirtiri karo sababtoo ah waxay leedahay taariikh clinical ah oo ku xiran (sida Ballamo, Daawooyin, ama Baaritaano). Fadlan ku beddel xaaladdeeda "Inactive" bedelkii aad tirtiri lahayd.' 
        });
      }
      throw profileError;
    }

    // 2. If database delete succeeds, delete from Supabase Auth admin
    const { error: authError } = await supabase.auth.admin.deleteUser(id);
    if (authError) {
      console.warn('Supabase Auth deletion warning:', authError.message);
    }

    res.json({ success: true, message: 'Shaqaalaha si guul leh ayaa loo tirtiray!' });
  } catch (err) {
    console.error('Error deleting staff:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────
app.listen(port, async () => {
  console.log(`\n🚀 Backend running on http://localhost:${port}`);
  console.log('🔧 Attempting to auto-fix database trigger...');
  await fixTrigger();
});
