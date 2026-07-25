-- Cayuush Clinic Management System - Phase 3 Schema (Pharmacy & Laboratory)
-- Execute this file in your Supabase SQL Editor

-- ==========================================
-- PHARMACY MODULE
-- ==========================================

-- Enums
CREATE TYPE medicine_status AS ENUM ('In Stock', 'Low Stock', 'Out of Stock', 'Expired');
CREATE TYPE prescription_status AS ENUM ('Pending', 'Dispensed', 'Cancelled');

-- 1. Medicines Table (Inventory)
CREATE TABLE IF NOT EXISTS public.medicines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  generic_name TEXT,
  category TEXT,
  batch_number TEXT,
  expiry_date DATE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  status medicine_status DEFAULT 'In Stock',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;

-- 2. Prescriptions Table (Linking Patients to Medicines)
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.profiles(id),
  medicine_id UUID REFERENCES public.medicines(id),
  dosage TEXT NOT NULL,
  duration TEXT NOT NULL,
  status prescription_status DEFAULT 'Pending',
  dispensed_by UUID REFERENCES public.profiles(id),
  dispensed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- LABORATORY MODULE
-- ==========================================

-- Enums
CREATE TYPE lab_request_status AS ENUM ('Pending', 'In Progress', 'Completed', 'Cancelled');

-- 3. Lab Catalog Table (Available Tests)
CREATE TABLE IF NOT EXISTS public.lab_catalog (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  test_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.lab_catalog ENABLE ROW LEVEL SECURITY;

-- 4. Lab Requests Table (Orders from Doctors)
CREATE TABLE IF NOT EXISTS public.lab_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.profiles(id),
  test_id UUID REFERENCES public.lab_catalog(id),
  status lab_request_status DEFAULT 'Pending',
  result_text TEXT,
  result_file_url TEXT,
  notes TEXT,
  performed_by UUID REFERENCES public.profiles(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.lab_requests ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- POLICIES & TRIGGERS
-- ==========================================

-- Medicines Policies
CREATE POLICY "Authenticated users can view medicines" ON public.medicines FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert medicines" ON public.medicines FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update medicines" ON public.medicines FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete medicines" ON public.medicines FOR DELETE USING (auth.role() = 'authenticated');

-- Prescriptions Policies
CREATE POLICY "Authenticated users can view prescriptions" ON public.prescriptions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert prescriptions" ON public.prescriptions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update prescriptions" ON public.prescriptions FOR UPDATE USING (auth.role() = 'authenticated');

-- Lab Catalog Policies
CREATE POLICY "Authenticated users can view lab_catalog" ON public.lab_catalog FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert lab_catalog" ON public.lab_catalog FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update lab_catalog" ON public.lab_catalog FOR UPDATE USING (auth.role() = 'authenticated');

-- Lab Requests Policies
CREATE POLICY "Authenticated users can view lab_requests" ON public.lab_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert lab_requests" ON public.lab_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update lab_requests" ON public.lab_requests FOR UPDATE USING (auth.role() = 'authenticated');

-- Triggers for updated_at
CREATE TRIGGER set_medicines_updated_at BEFORE UPDATE ON public.medicines FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER set_prescriptions_updated_at BEFORE UPDATE ON public.prescriptions FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER set_lab_requests_updated_at BEFORE UPDATE ON public.lab_requests FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- Add mock Lab Catalog data
INSERT INTO public.lab_catalog (test_name, category, price) VALUES 
('Complete Blood Count (CBC)', 'Hematology', 15.00),
('Urinalysis', 'Microbiology', 10.00),
('Blood Sugar (Fasting)', 'Biochemistry', 8.00),
('Pregnancy Test (Blood)', 'Hormonal', 20.00),
('Liver Function Test (LFT)', 'Biochemistry', 35.00);
