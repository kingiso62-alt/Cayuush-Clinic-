-- Procedures and Minor Surgery Schema
CREATE TABLE IF NOT EXISTS public.procedure_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL, -- 'Minor Surgery', 'Endoscopy', 'Cardiology', 'Orthopedics', 'General'
    default_price NUMERIC NOT NULL DEFAULT 0.00,
    required_department TEXT,
    required_equipment TEXT,
    preparation_instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.procedures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    assistants TEXT,
    procedure_catalog_id UUID NOT NULL REFERENCES public.procedure_catalog(id) ON DELETE CASCADE,
    procedure_room TEXT,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    pre_procedure_assessment TEXT,
    consent_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    consent_certificate_id UUID REFERENCES public.medical_certificates(id) ON DELETE SET NULL,
    anaesthesia_type TEXT NOT NULL DEFAULT 'None', -- 'Local', 'Regional', 'General', 'Sedation', 'None'
    procedure_notes TEXT,
    complications TEXT,
    post_procedure_instructions TEXT,
    follow_up_date DATE,
    used_supplies JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { medicine_id, name, quantity, unit_price }
    status TEXT NOT NULL DEFAULT 'Planned', -- 'Planned', 'Confirmed', 'In Progress', 'Completed', 'Postponed', 'Cancelled'
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.procedure_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;

-- Allow all actions for authenticated users
DROP POLICY IF EXISTS "Allow all actions for auth users on procedure_catalog" ON public.procedure_catalog;
CREATE POLICY "Allow all actions for auth users on procedure_catalog" 
    ON public.procedure_catalog FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all actions for auth users on procedures" ON public.procedures;
CREATE POLICY "Allow all actions for auth users on procedures" 
    ON public.procedures FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert some default catalog items if empty
INSERT INTO public.procedure_catalog (name, category, default_price, required_department, required_equipment, preparation_instructions)
VALUES 
('Suture Removal', 'Minor Surgery', 25.00, 'Emergency', 'Suture removal kit, Antiseptic solution', 'Clean the wound area'),
('Abscess Incision & Drainage', 'Minor Surgery', 50.00, 'Surgery', 'Scalpel, Gauze, Local Anaesthetic', 'Fasting not required'),
('Wound Debridement', 'Minor Surgery', 40.00, 'Surgery', 'Debridement kit, Sterile saline', 'No preparation needed')
ON CONFLICT (name) DO NOTHING;
