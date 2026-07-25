const { Client } = require('pg');

const clientConfig = {
  host: 'aws-0-eu-west-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.bftklevvcvsgzrvmyvlo',
  password: 'Cayuush2026',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function seed() {
  const client = new Client(clientConfig);
  try {
    await client.connect();
    console.log('Seeding buildings, floors, wards, rooms, and beds...');
    
    // 1. Buildings
    const bResult = await client.query(`
      INSERT INTO public.buildings (name, description)
      VALUES ('Main Block', 'Primary care and inpatient services building')
      ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
      RETURNING id;
    `);
    const buildingId = bResult.rows[0].id;

    // 2. Floors
    const fResult = await client.query(`
      INSERT INTO public.floors (building_id, floor_number, name)
      VALUES 
      ('${buildingId}', 1, 'First Floor'),
      ('${buildingId}', 2, 'Second Floor')
      ON CONFLICT DO NOTHING
      RETURNING id;
    `);
    
    let floorId = fResult.rows[0] ? fResult.rows[0].id : null;
    if (!floorId) {
      const getFloor = await client.query('SELECT id FROM floors LIMIT 1');
      floorId = getFloor.rows[0].id;
    }

    // 3. Wards
    const wResult = await client.query(`
      INSERT INTO public.wards (floor_id, name, description)
      VALUES 
      ('${floorId}', 'General Ward A', 'Standard ward area for stable patients'),
      ('${floorId}', 'ICU Ward B', 'Intensive Care Unit with premium monitors')
      ON CONFLICT DO NOTHING
      RETURNING id, name;
    `);

    let genWardId = null;
    let icuWardId = null;

    wResult.rows.forEach(r => {
      if (r.name.includes('General')) genWardId = r.id;
      if (r.name.includes('ICU')) icuWardId = r.id;
    });

    if (!genWardId || !icuWardId) {
      const getWards = await client.query('SELECT id, name FROM wards LIMIT 2');
      genWardId = getWards.rows[0].id;
      icuWardId = getWards.rows[1] ? getWards.rows[1].id : getWards.rows[0].id;
    }

    // 4. Rooms
    const rResult = await client.query(`
      INSERT INTO public.rooms (ward_id, room_number, room_type)
      VALUES 
      ('${genWardId}', 'Room-101', 'General'),
      ('${genWardId}', 'Room-102', 'General'),
      ('${icuWardId}', 'Room-201', 'ICU')
      ON CONFLICT DO NOTHING
      RETURNING id, room_number;
    `);

    let r101 = null;
    let r102 = null;
    let r201 = null;

    rResult.rows.forEach(r => {
      if (r.room_number === 'Room-101') r101 = r.id;
      if (r.room_number === 'Room-102') r102 = r.id;
      if (r.room_number === 'Room-201') r201 = r.id;
    });

    if (!r101 || !r201) {
      const getRooms = await client.query('SELECT id, room_number FROM rooms LIMIT 3');
      r101 = getRooms.rows[0].id;
      r102 = getRooms.rows[1] ? getRooms.rows[1].id : getRooms.rows[0].id;
      r201 = getRooms.rows[2] ? getRooms.rows[2].id : getRooms.rows[0].id;
    }

    // 5. Beds
    await client.query(`
      INSERT INTO public.beds (room_id, bed_number, bed_type, price_per_day, availability_status)
      VALUES 
      ('${r101}', 'Bed-101A', 'Standard Daybed', 15.00, 'Available'),
      ('${r101}', 'Bed-101B', 'Standard Daybed', 15.00, 'Available'),
      ('${r102}', 'Bed-102A', 'Semi-Private Bed', 25.00, 'Available'),
      ('${r102}', 'Bed-102B', 'Semi-Private Bed', 25.00, 'Available'),
      ('${r201}', 'Bed-201-ICU', 'ICU Critical Bed', 75.00, 'Available')
      ON CONFLICT DO NOTHING;
    `);

    console.log('Successfully seeded all facilities tables!');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

seed();
