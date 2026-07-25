-- Referral Management Table Schema
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_number TEXT UNIQUE NOT NULL,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    referral_type TEXT NOT NULL, -- 'Internal Department', 'Doctor to Doctor', 'External Hospital', 'Specialist', 'Laboratory', 'Radiology'
    referring_doctor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    receiving_doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    receiving_facility TEXT,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    referral_reason TEXT NOT NULL,
    clinical_summary TEXT,
    diagnosis TEXT,
    priority TEXT NOT NULL DEFAULT 'Routine', -- 'Routine', 'Urgent', 'Emergency'
    referral_date DATE NOT NULL DEFAULT CURRENT_DATE,
    appointment_date DATE,
    attached_results TEXT,
    status TEXT NOT NULL DEFAULT 'Draft', -- 'Draft', 'Sent', 'Accepted', 'Scheduled', 'Completed', 'Rejected', 'Cancelled'
    outcome TEXT,
    follow_up_instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users
DROP POLICY IF EXISTS "Allow all actions for authenticated users on referrals" ON public.referrals;
CREATE POLICY "Allow all actions for authenticated users on referrals" 
    ON public.referrals FOR ALL TO authenticated USING (true) WITH CHECK (true);
