-- Cayuush Clinic - Phase 8 Upgrades (Vaccines, Expenses, Certificates)
-- Execute this file in your Supabase SQL Editor.

-- 1. Vaccines Table
CREATE TABLE IF NOT EXISTS public.vaccinations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  vaccine_name VARCHAR(100) NOT NULL,
  dose_number VARCHAR(20) NOT NULL, -- e.g. 1st Dose, 2nd Dose, Booster
  date_administered DATE NOT NULL,
  next_dose_due DATE,
  administered_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Vaccines
ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view vaccinations" ON public.vaccinations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert vaccinations" ON public.vaccinations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update vaccinations" ON public.vaccinations FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete vaccinations" ON public.vaccinations FOR DELETE USING (auth.role() = 'authenticated');


-- 2. Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  expense_date DATE NOT NULL,
  category VARCHAR(100) NOT NULL, -- e.g. Rent, Utilities, Salaries, Supplies
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  recorded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view expenses" ON public.expenses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert expenses" ON public.expenses FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update expenses" ON public.expenses FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete expenses" ON public.expenses FOR DELETE USING (auth.role() = 'authenticated');


-- 3. Certificates Table (Consent forms, Sick leave, Medical certificates)
CREATE TABLE IF NOT EXISTS public.medical_certificates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.profiles(id),
  type VARCHAR(50) NOT NULL, -- e.g. Sick Leave, Surgery Consent, Medical Fitness
  issue_date DATE NOT NULL,
  start_date DATE, -- For sick leave
  end_date DATE,   -- For sick leave
  diagnosis TEXT,
  description TEXT,
  status VARCHAR(20) DEFAULT 'Approved',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Certificates
ALTER TABLE public.medical_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view certificates" ON public.medical_certificates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert certificates" ON public.medical_certificates FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update certificates" ON public.medical_certificates FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete certificates" ON public.medical_certificates FOR DELETE USING (auth.role() = 'authenticated');
