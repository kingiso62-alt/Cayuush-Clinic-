-- Emergency Cases and Ambulance Schema
CREATE TABLE IF NOT EXISTS public.emergency_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number TEXT UNIQUE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL, -- Nullable for unknown patients
    unknown_patient_description TEXT, -- Generic info when patient has no file
    arrival_method TEXT NOT NULL DEFAULT 'Walk-in', -- 'Walk-in', 'Ambulance', 'Brought by Relative', 'Police'
    arrival_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    emergency_contact TEXT,
    initial_complaint TEXT NOT NULL,
    triage_category TEXT NOT NULL DEFAULT 'Green', -- 'Red', 'Orange', 'Yellow', 'Green', 'Blue'
    assigned_doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    immediate_treatment TEXT,
    emergency_medications TEXT,
    procedures_performed TEXT,
    admission_decision TEXT NOT NULL DEFAULT 'Discharged', -- 'Admitted', 'Discharged', 'Transferred', 'Observation'
    transfer_destination TEXT,
    discharge_outcome TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ambulance_trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ambulance_number TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    medical_staff TEXT,
    pickup_location TEXT NOT NULL,
    destination TEXT NOT NULL DEFAULT 'Cayush Specialist Clinic',
    dispatch_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    arrival_time TIMESTAMPTZ,
    trip_status TEXT NOT NULL DEFAULT 'Dispatched', -- 'Dispatched', 'En Route', 'Completed', 'Cancelled'
    patient_condition TEXT,
    trip_expense NUMERIC NOT NULL DEFAULT 0.00,
    emergency_case_id UUID REFERENCES public.emergency_cases(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.emergency_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulance_trips ENABLE ROW LEVEL SECURITY;

-- Allow all actions for authenticated users
DROP POLICY IF EXISTS "Allow all actions for auth users on emergency_cases" ON public.emergency_cases;
CREATE POLICY "Allow all actions for auth users on emergency_cases" 
    ON public.emergency_cases FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all actions for auth users on ambulance_trips" ON public.ambulance_trips;
CREATE POLICY "Allow all actions for auth users on ambulance_trips" 
    ON public.ambulance_trips FOR ALL TO authenticated USING (true) WITH CHECK (true);
