-- SMS & WhatsApp Communications Log Schema
CREATE TABLE IF NOT EXISTS public.communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'WhatsApp', -- 'SMS', 'WhatsApp'
    message_type TEXT NOT NULL DEFAULT 'General', -- 'Appointment', 'Lab Result', 'Invoice', 'General'
    message_content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Sent', -- 'Pending', 'Sent', 'Failed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write logs
DROP POLICY IF EXISTS "Allow all for auth users on communications" ON public.communications;
CREATE POLICY "Allow all for auth users on communications" ON public.communications FOR ALL TO authenticated USING (true) WITH CHECK (true);
