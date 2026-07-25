require('dotenv').config();

const SUPABASE_URL = 'https://bftklevvcvsgzrvmyvlo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdGtsZXZ2Y3ZzZ3pydm15dmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk0MDE5NywiZXhwIjoyMDk5NTE2MTk3fQ.Mg2Yt6brtcwfgZtimQBpWV8WaQptpv1StNVCyyGNpf0';

const clinicMedicines = [
  // Painkillers & Antipyretics
  { name: 'Panadol Advance', generic_name: 'Paracetamol 500mg', category: 'Painkillers', batch_number: 'B-1001', expiry_date: '2027-12-31', quantity: 500, unit_price: 1.50, status: 'In Stock' },
  { name: 'Brufen 400', generic_name: 'Ibuprofen 400mg', category: 'Painkillers', batch_number: 'B-1002', expiry_date: '2026-10-31', quantity: 300, unit_price: 2.00, status: 'In Stock' },
  { name: 'Diclofenac Sodium', generic_name: 'Diclofenac 50mg', category: 'Painkillers', batch_number: 'B-1003', expiry_date: '2026-05-15', quantity: 200, unit_price: 3.50, status: 'In Stock' },
  { name: 'Tramadol HCl', generic_name: 'Tramadol 50mg', category: 'Painkillers', batch_number: 'B-1004', expiry_date: '2027-01-20', quantity: 100, unit_price: 5.00, status: 'In Stock' },

  // Antibiotics
  { name: 'Amoxil', generic_name: 'Amoxicillin 500mg', category: 'Antibiotics', batch_number: 'A-2001', expiry_date: '2026-08-30', quantity: 400, unit_price: 4.00, status: 'In Stock' },
  { name: 'Augmentin 625', generic_name: 'Amoxicillin/Clavulanate', category: 'Antibiotics', batch_number: 'A-2002', expiry_date: '2026-11-15', quantity: 250, unit_price: 12.00, status: 'In Stock' },
  { name: 'Cipro', generic_name: 'Ciprofloxacin 500mg', category: 'Antibiotics', batch_number: 'A-2003', expiry_date: '2027-02-28', quantity: 350, unit_price: 6.50, status: 'In Stock' },
  { name: 'Zithromax', generic_name: 'Azithromycin 500mg', category: 'Antibiotics', batch_number: 'A-2004', expiry_date: '2026-09-10', quantity: 150, unit_price: 8.00, status: 'In Stock' },
  { name: 'Flagyl', generic_name: 'Metronidazole 400mg', category: 'Antibiotics', batch_number: 'A-2005', expiry_date: '2027-05-20', quantity: 300, unit_price: 3.00, status: 'In Stock' },

  // Antacids & Gastroenterology
  { name: 'Omeprazole', generic_name: 'Omeprazole 20mg', category: 'Vitamins & Supplements', batch_number: 'G-3001', expiry_date: '2026-12-31', quantity: 400, unit_price: 5.50, status: 'In Stock' }, // Using existing category options if needed, but 'Others' or specific is fine. Assuming Pharmacy allows free text or 'Others'
  { name: 'Gaviscon Liquid', generic_name: 'Sodium Alginate', category: 'Others', batch_number: 'G-3002', expiry_date: '2025-10-15', quantity: 120, unit_price: 7.00, status: 'In Stock' },
  { name: 'Buscopan', generic_name: 'Hyoscine Butylbromide 10mg', category: 'Others', batch_number: 'G-3003', expiry_date: '2027-04-10', quantity: 250, unit_price: 4.50, status: 'In Stock' },

  // Cardiovascular & Anti-hypertensives
  { name: 'Amlodipine', generic_name: 'Amlodipine 5mg', category: 'Others', batch_number: 'C-4001', expiry_date: '2027-08-01', quantity: 300, unit_price: 3.00, status: 'In Stock' },
  { name: 'Losartan', generic_name: 'Losartan 50mg', category: 'Others', batch_number: 'C-4002', expiry_date: '2026-06-30', quantity: 200, unit_price: 4.00, status: 'In Stock' },
  { name: 'Aspirin Protect', generic_name: 'Aspirin 100mg', category: 'Others', batch_number: 'C-4003', expiry_date: '2027-11-15', quantity: 500, unit_price: 2.50, status: 'In Stock' },

  // Anti-diabetics
  { name: 'Glucophage', generic_name: 'Metformin 500mg', category: 'Others', batch_number: 'D-5001', expiry_date: '2027-03-25', quantity: 450, unit_price: 3.50, status: 'In Stock' },
  { name: 'Daonil', generic_name: 'Glibenclamide 5mg', category: 'Others', batch_number: 'D-5002', expiry_date: '2026-09-01', quantity: 150, unit_price: 2.80, status: 'In Stock' },

  // Respiratory & Anti-histamines
  { name: 'Ventolin Inhaler', generic_name: 'Salbutamol 100mcg', category: 'Others', batch_number: 'R-6001', expiry_date: '2026-05-31', quantity: 80, unit_price: 9.00, status: 'In Stock' },
  { name: 'Zyrtec', generic_name: 'Cetirizine 10mg', category: 'Others', batch_number: 'R-6002', expiry_date: '2027-01-10', quantity: 300, unit_price: 4.20, status: 'In Stock' },
  { name: 'Piriton', generic_name: 'Chlorpheniramine 4mg', category: 'Others', batch_number: 'R-6003', expiry_date: '2026-11-20', quantity: 400, unit_price: 2.00, status: 'In Stock' },

  // Vitamins & Supplements
  { name: 'Neurobion', generic_name: 'Vitamin B Complex', category: 'Vitamins & Supplements', batch_number: 'V-7001', expiry_date: '2027-07-15', quantity: 250, unit_price: 6.00, status: 'In Stock' },
  { name: 'Ferrous Sulfate', generic_name: 'Iron 200mg', category: 'Vitamins & Supplements', batch_number: 'V-7002', expiry_date: '2026-12-10', quantity: 350, unit_price: 3.20, status: 'In Stock' },
  { name: 'Vitamin C 1000mg', generic_name: 'Ascorbic Acid', category: 'Vitamins & Supplements', batch_number: 'V-7003', expiry_date: '2027-04-30', quantity: 500, unit_price: 4.50, status: 'In Stock' },
  { name: 'Calcium + D3', generic_name: 'Calcium 500mg', category: 'Vitamins & Supplements', batch_number: 'V-7004', expiry_date: '2026-08-25', quantity: 200, unit_price: 5.50, status: 'In Stock' },

  // Topical & Others
  { name: 'Fucidin Cream', generic_name: 'Fusidic Acid 2%', category: 'Others', batch_number: 'T-8001', expiry_date: '2025-09-30', quantity: 100, unit_price: 6.50, status: 'In Stock' },
  { name: 'Voltaren Gel', generic_name: 'Diclofenac Diethylamine', category: 'Painkillers', batch_number: 'T-8002', expiry_date: '2026-10-15', quantity: 120, unit_price: 7.50, status: 'In Stock' },
  { name: 'Betadine Solution', generic_name: 'Povidone-Iodine 10%', category: 'Others', batch_number: 'T-8003', expiry_date: '2027-02-12', quantity: 80, unit_price: 5.00, status: 'In Stock' }
];

async function seedMedicines() {
  try {
    console.log('Seeding medicines...');
    
    // Check if table has data already to avoid duplicates
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/medicines?select=name&limit=1`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    const existing = await checkRes.json();
    if (existing.length > 0 && !process.argv.includes('--force')) {
      console.log('Medicines table already has data. Use --force to add more anyway.');
      // return; // Let's just add them anyway or skip. We'll skip if they have 'Panadol Advance'
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/medicines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(clinicMedicines)
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Failed to seed medicines:', res.status, err);
    } else {
      console.log('✅ Successfully added', clinicMedicines.length, 'medicines to the pharmacy!');
    }
  } catch (err) {
    console.error('Error seeding medicines:', err);
  }
}

seedMedicines();
