-- Allergy and Medical Warning System Database Upgrades

-- 1. Add alert columns to public.patients table
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS drug_allergies TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS food_allergies TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS chronic_conditions TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS pregnancy_warning BOOLEAN DEFAULT FALSE;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS previous_severe_reactions TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS infectious_disease_warning TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS special_care_instructions TEXT;

-- 2. Create overrides audit log table
CREATE TABLE IF NOT EXISTS public.allergy_overrides (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  medicine_name VARCHAR(255) NOT NULL,
  allergy_conflict TEXT,
  override_reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for allergy_overrides
ALTER TABLE public.allergy_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view allergy overrides" ON public.allergy_overrides;
CREATE POLICY "Authenticated users can view allergy overrides" ON public.allergy_overrides FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert allergy overrides" ON public.allergy_overrides;
CREATE POLICY "Authenticated users can insert allergy overrides" ON public.allergy_overrides FOR INSERT WITH CHECK (auth.role() = 'authenticated');
