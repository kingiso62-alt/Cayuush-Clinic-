-- Maternity and Antenatal Care Schema
CREATE TABLE IF NOT EXISTS public.maternity_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    lmp_date DATE NOT NULL,
    edd_date DATE NOT NULL,
    gravida INTEGER NOT NULL DEFAULT 1,
    para INTEGER NOT NULL DEFAULT 0,
    previous_pregnancies TEXT,
    previous_complications TEXT,
    risk_assessment TEXT NOT NULL DEFAULT 'Low Risk', -- 'Low Risk', 'Medium Risk', 'High Risk'
    delivery_plan TEXT,
    status TEXT NOT NULL DEFAULT 'Active', -- 'Active', 'Completed', 'Cancelled'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.antenatal_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maternity_registration_id UUID NOT NULL REFERENCES public.maternity_registrations(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    weight NUMERIC,
    blood_pressure TEXT,
    fetal_heart_rate INTEGER, -- bpm
    fundal_height NUMERIC, -- cm
    fetal_movement TEXT,
    ultrasound_notes TEXT,
    supplements TEXT,
    vaccinations TEXT,
    notes TEXT,
    next_appointment DATE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.delivery_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maternity_registration_id UUID NOT NULL REFERENCES public.maternity_registrations(id) ON DELETE CASCADE,
    mother_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    delivery_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivery_type TEXT NOT NULL, -- 'Normal Vaginal', 'C-Section', 'Assisted Vaginal'
    attending_doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    baby_gender TEXT NOT NULL, -- 'Male', 'Female', 'Other'
    birth_weight NUMERIC NOT NULL, -- kg
    apgar_1min INTEGER,
    apgar_5min INTEGER,
    mother_condition TEXT,
    baby_condition TEXT,
    complications TEXT,
    delivery_notes TEXT,
    newborn_patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.maternity_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.antenatal_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_records ENABLE ROW LEVEL SECURITY;

-- Allow all actions for authenticated users
DROP POLICY IF EXISTS "Allow all for auth users on maternity_registrations" ON public.maternity_registrations;
CREATE POLICY "Allow all for auth users on maternity_registrations" 
    ON public.maternity_registrations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for auth users on antenatal_visits" ON public.antenatal_visits;
CREATE POLICY "Allow all for auth users on antenatal_visits" 
    ON public.antenatal_visits FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for auth users on delivery_records" ON public.delivery_records;
CREATE POLICY "Allow all for auth users on delivery_records" 
    ON public.delivery_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
