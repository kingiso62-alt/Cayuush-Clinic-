-- Phase 6: Debts Tracking Table Setup
CREATE TABLE IF NOT EXISTS public.debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    patient_name VARCHAR(255) NOT NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    due_date DATE NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending', -- 'Pending' | 'Paid'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow select debts" ON public.debts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert debts" ON public.debts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update debts" ON public.debts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete debts" ON public.debts FOR DELETE TO authenticated USING (true);
