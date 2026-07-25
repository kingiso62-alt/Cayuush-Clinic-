-- Staff Attendance, Shifts, Leave and Payroll Schema
CREATE TABLE IF NOT EXISTS public.staff_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- 'Morning', 'Evening', 'Night', 'Custom'
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shift_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES public.staff_shifts(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    assignment_date DATE NOT NULL,
    is_on_call BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'Scheduled', -- 'Scheduled', 'Active', 'Swapped', 'Completed', 'Cancelled'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    record_date DATE NOT NULL DEFAULT CURRENT_DATE,
    clock_in TIME,
    clock_out TIME,
    is_late BOOLEAN NOT NULL DEFAULT FALSE,
    is_early_departure BOOLEAN NOT NULL DEFAULT FALSE,
    is_absent BOOLEAN NOT NULL DEFAULT FALSE,
    overtime_hours NUMERIC NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_profile_date UNIQUE (profile_id, record_date)
);

CREATE TABLE IF NOT EXISTS public.shift_swaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requestor_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    shift_assignment_id UUID NOT NULL REFERENCES public.shift_assignments(id) ON DELETE CASCADE,
    target_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL, -- 'Sick Leave', 'Annual Leave', 'Maternity Leave', 'Casual Leave'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    basic_salary NUMERIC NOT NULL DEFAULT 0.00,
    allowances NUMERIC NOT NULL DEFAULT 0.00,
    overtime NUMERIC NOT NULL DEFAULT 0.00,
    bonuses NUMERIC NOT NULL DEFAULT 0.00,
    deductions NUMERIC NOT NULL DEFAULT 0.00,
    advances NUMERIC NOT NULL DEFAULT 0.00,
    net_salary NUMERIC NOT NULL DEFAULT 0.00,
    payment_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Unpaid', -- 'Paid', 'Unpaid'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

-- Allow all actions for authenticated users
DROP POLICY IF EXISTS "Allow all for auth users on staff_shifts" ON public.staff_shifts;
CREATE POLICY "Allow all for auth users on staff_shifts" 
    ON public.staff_shifts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for auth users on shift_assignments" ON public.shift_assignments;
CREATE POLICY "Allow all for auth users on shift_assignments" 
    ON public.shift_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for auth users on attendance_records" ON public.attendance_records;
CREATE POLICY "Allow all for auth users on attendance_records" 
    ON public.attendance_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for auth users on shift_swaps" ON public.shift_swaps;
CREATE POLICY "Allow all for auth users on shift_swaps" 
    ON public.shift_swaps FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for auth users on leave_requests" ON public.leave_requests;
CREATE POLICY "Allow all for auth users on leave_requests" 
    ON public.leave_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for auth users on payroll_records" ON public.payroll_records;
CREATE POLICY "Allow all for auth users on payroll_records" 
    ON public.payroll_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert Default Shifts
INSERT INTO public.staff_shifts (name, start_time, end_time, description)
VALUES 
('Morning Shift', '08:00:00', '16:00:00', 'Standard Day Shift'),
('Evening Shift', '16:00:00', '00:00:00', 'Evening shift duties'),
('Night Shift', '00:00:00', '08:00:00', 'Overnight critical care coverage')
ON CONFLICT DO NOTHING;
