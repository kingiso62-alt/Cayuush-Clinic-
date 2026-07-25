-- Cayuush Clinic Management System - Phase 5 Schema (Inpatients)
-- Execute this file in your Supabase SQL Editor

-- 1. Fix the missing status column on patients
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';

-- 2. Create the Inpatients table
CREATE TABLE IF NOT EXISTS public.inpatients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.profiles(id),
  admission_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  discharge_date TIMESTAMP WITH TIME ZONE,
  room_number TEXT,
  bed_number TEXT,
  status TEXT DEFAULT 'Admitted', -- 'Admitted', 'Discharged'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS and create policies
ALTER TABLE public.inpatients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view inpatients" ON public.inpatients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert inpatients" ON public.inpatients FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update inpatients" ON public.inpatients FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete inpatients" ON public.inpatients FOR DELETE USING (auth.role() = 'authenticated');

-- 4. Add set_updated_at trigger (uses the existing set_updated_at function)
CREATE OR REPLACE TRIGGER set_inpatients_updated_at 
  BEFORE UPDATE ON public.inpatients 
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
