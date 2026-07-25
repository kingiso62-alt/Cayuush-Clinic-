-- Cayuush Clinic Management System - Phase 4 Schema (Billing & Settings)
-- Execute this file in your Supabase SQL Editor

-- ==========================================
-- BILLING MODULE
-- ==========================================

-- Enums
CREATE TYPE invoice_status AS ENUM ('Unpaid', 'Partial', 'Paid', 'Cancelled');
CREATE TYPE payment_method AS ENUM ('Cash', 'Card', 'Mobile Money', 'Bank Transfer', 'Other');

-- 1. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_number VARCHAR(20) UNIQUE NOT NULL, -- e.g. INV-1001
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.profiles(id),
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  tax DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  status invoice_status DEFAULT 'Unpaid',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 2. Invoice Items Table (The individual charges)
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- 3. Payments Table (Tracking transactions)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'Cash',
  transaction_ref TEXT, -- e.g. EvcPlus receipt number
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  received_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SETTINGS / CLINIC INFO MODULE
-- ==========================================

-- 4. Clinic Settings Table
CREATE TABLE IF NOT EXISTS public.clinic_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  clinic_name TEXT NOT NULL DEFAULT 'Cayuush Clinic',
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  tax_percentage DECIMAL(5, 2) DEFAULT 0.00,
  currency VARCHAR(10) DEFAULT 'USD',
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

-- Insert default settings
INSERT INTO public.clinic_settings (clinic_name, address, phone, email) 
VALUES ('Cayuush Clinic', 'Mogadishu, Somalia', '+252 61 000 0000', 'info@cayush.com')
ON CONFLICT DO NOTHING;


-- ==========================================
-- POLICIES & TRIGGERS
-- ==========================================

-- Invoices
CREATE POLICY "Authenticated users can view invoices" ON public.invoices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert invoices" ON public.invoices FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update invoices" ON public.invoices FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete invoices" ON public.invoices FOR DELETE USING (auth.role() = 'authenticated');

-- Invoice Items
CREATE POLICY "Authenticated users can view invoice_items" ON public.invoice_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert invoice_items" ON public.invoice_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete invoice_items" ON public.invoice_items FOR DELETE USING (auth.role() = 'authenticated');

-- Payments
CREATE POLICY "Authenticated users can view payments" ON public.payments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert payments" ON public.payments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Clinic Settings
CREATE POLICY "Authenticated users can view clinic_settings" ON public.clinic_settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update clinic_settings" ON public.clinic_settings FOR UPDATE USING (auth.role() = 'authenticated');

-- Triggers for updated_at
CREATE TRIGGER set_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER set_clinic_settings_updated_at BEFORE UPDATE ON public.clinic_settings FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- Trigger to auto-update invoice amount_paid and status when a payment is made
CREATE OR REPLACE FUNCTION update_invoice_after_payment() 
RETURNS TRIGGER AS $$
BEGIN
  -- Update the amount_paid on the invoice
  UPDATE public.invoices 
  SET amount_paid = (
    SELECT COALESCE(SUM(amount), 0) 
    FROM public.payments 
    WHERE invoice_id = NEW.invoice_id
  )
  WHERE id = NEW.invoice_id;

  -- Update status
  UPDATE public.invoices 
  SET status = CASE 
    WHEN amount_paid >= total_amount THEN 'Paid'::invoice_status
    WHEN amount_paid > 0 THEN 'Partial'::invoice_status
    ELSE 'Unpaid'::invoice_status
  END
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_payment_inserted
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE PROCEDURE update_invoice_after_payment();
