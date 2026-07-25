-- Clinical Encounter and EMR System Tables
-- 1. Encounters Table
CREATE TABLE IF NOT EXISTS public.encounters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  encounter_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  department VARCHAR(100),
  visit_type VARCHAR(50) DEFAULT 'OPD',
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  visit_time TIME NOT NULL DEFAULT CURRENT_TIME,
  chief_complaint TEXT,
  hpi TEXT,
  previous_illnesses TEXT,
  family_history TEXT,
  allergies TEXT,
  current_medications TEXT,
  physical_examination TEXT,
  doctor_notes TEXT,
  diagnosis TEXT,
  icd_code VARCHAR(50),
  treatment_plan TEXT,
  follow_up_date DATE,
  status VARCHAR(50) DEFAULT 'Waiting', -- Waiting, In Consultation, Awaiting Laboratory, Awaiting Radiology, Awaiting Pharmacy, Follow-up Required, Completed, Cancelled
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Alter Existing Tables to support encounter link
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL;

-- 3. If there are tables for lab_requests, let's alter them too
-- Let's make sure they have encounter_id
ALTER TABLE public.lab_requests ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL;
ALTER TABLE public.inpatients ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL;

-- 4. Triage Records Table
CREATE TABLE IF NOT EXISTS public.triage_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
  blood_pressure VARCHAR(20), -- e.g. "120/80"
  temperature NUMERIC(4,1),    -- e.g. 37.5
  pulse_rate INTEGER,          -- bpm
  respiratory_rate INTEGER,    -- per min
  oxygen_saturation INTEGER,   -- %
  weight NUMERIC(5,2),         -- kg
  height NUMERIC(5,2),         -- cm
  bmi NUMERIC(4,1),
  blood_glucose INTEGER,       -- mg/dL
  pain_score INTEGER,          -- 0 to 10
  consciousness_level VARCHAR(50) DEFAULT 'Alert', -- Alert, Voice, Pain, Unresponsive
  pregnancy_status BOOLEAN DEFAULT FALSE,
  triage_notes TEXT,
  allergy_warning TEXT,
  emergency_flag BOOLEAN DEFAULT FALSE,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

