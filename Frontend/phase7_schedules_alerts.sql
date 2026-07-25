-- Cayuush Clinic Management System - Phase 7 Doctor Schedules Table Schema
-- Execute this file in your Supabase SQL Editor to support schedules.

CREATE TABLE IF NOT EXISTS public.doctor_schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  doctor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week VARCHAR(20) NOT NULL, -- e.g. Monday, Tuesday, etc.
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(20) DEFAULT 'Active', -- e.g. Active, On Leave, Out of Office
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view schedules" ON public.doctor_schedules FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert schedules" ON public.doctor_schedules FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update schedules" ON public.doctor_schedules FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete schedules" ON public.doctor_schedules FOR DELETE USING (auth.role() = 'authenticated');
