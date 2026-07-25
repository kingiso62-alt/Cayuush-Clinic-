-- Bed, Ward, Room and Facilities Management Schema
CREATE TABLE IF NOT EXISTS public.buildings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.floors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    floor_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_id UUID NOT NULL REFERENCES public.floors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id UUID NOT NULL REFERENCES public.wards(id) ON DELETE CASCADE,
    room_number TEXT NOT NULL,
    room_type TEXT NOT NULL DEFAULT 'General', -- 'Private', 'Semi-Private', 'General', 'ICU', 'Isolation'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.beds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    bed_number TEXT NOT NULL,
    bed_type TEXT NOT NULL DEFAULT 'Standard',
    price_per_day NUMERIC NOT NULL DEFAULT 20.00,
    availability_status TEXT NOT NULL DEFAULT 'Available', -- 'Available', 'Reserved', 'Occupied', 'Cleaning', 'Maintenance', 'Isolated'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bed_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inpatient_id UUID NOT NULL, -- references inpatients(id)
    from_bed_id UUID REFERENCES public.beds(id) ON DELETE SET NULL,
    to_bed_id UUID NOT NULL REFERENCES public.beds(id) ON DELETE RESTRICT,
    transfer_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bed_transfers ENABLE ROW LEVEL SECURITY;

-- Allow all actions for authenticated users
DROP POLICY IF EXISTS "Allow all for auth users on buildings" ON public.buildings;
CREATE POLICY "Allow all for auth users on buildings" ON public.buildings FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for auth users on floors" ON public.floors;
CREATE POLICY "Allow all for auth users on floors" ON public.floors FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for auth users on wards" ON public.wards;
CREATE POLICY "Allow all for auth users on wards" ON public.wards FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for auth users on rooms" ON public.rooms;
CREATE POLICY "Allow all for auth users on rooms" ON public.rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for auth users on beds" ON public.beds;
CREATE POLICY "Allow all for auth users on beds" ON public.beds FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for auth users on bed_transfers" ON public.bed_transfers;
CREATE POLICY "Allow all for auth users on bed_transfers" ON public.bed_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Run query to add bed_id to inpatients if it doesn't exist
-- We will run this dynamically via pg Client
