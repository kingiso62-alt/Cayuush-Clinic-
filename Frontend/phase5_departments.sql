-- Cayuush Clinic Management System - Phase 5 Departments Table Schema
-- Execute this file in your Supabase SQL Editor if you wish to store departments in the cloud

CREATE TABLE IF NOT EXISTS public.departments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  room VARCHAR(50),
  lead VARCHAR(100),
  description TEXT,
  status VARCHAR(20) DEFAULT 'Active',
  staff_count INTEGER DEFAULT 0,
  occupancy VARCHAR(50) DEFAULT 'Normal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view departments" ON public.departments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert departments" ON public.departments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update departments" ON public.departments FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete departments" ON public.departments FOR DELETE USING (auth.role() = 'authenticated');

-- Trigger to auto-update updated_at
CREATE TRIGGER set_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
