-- Suppliers, Procurement and Purchase Orders Schema
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    products_supplied TEXT,
    payment_terms TEXT,
    outstanding_balance NUMERIC NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'Active', -- 'Active', 'Inactive'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number TEXT UNIQUE NOT NULL,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    tax NUMERIC NOT NULL DEFAULT 0.00,
    discount NUMERIC NOT NULL DEFAULT 0.00,
    total NUMERIC NOT NULL DEFAULT 0.00,
    approval_status TEXT NOT NULL DEFAULT 'Draft', -- 'Draft', 'Sent', 'Approved', 'Rejected', 'Cancelled'
    payment_status TEXT NOT NULL DEFAULT 'Unpaid', -- 'Unpaid', 'Partially Paid', 'Paid'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    purchase_price NUMERIC NOT NULL CHECK (purchase_price >= 0),
    received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (received_quantity >= 0)
);

CREATE TABLE IF NOT EXISTS public.goods_receiving (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
    medicine_name TEXT NOT NULL,
    received_quantity INTEGER NOT NULL CHECK (received_quantity >= 0),
    rejected_quantity INTEGER NOT NULL DEFAULT 0 CHECK (rejected_quantity >= 0),
    batch_number TEXT NOT NULL,
    manufacture_date DATE,
    expiry_date DATE NOT NULL,
    cost_price NUMERIC NOT NULL CHECK (cost_price >= 0),
    selling_price NUMERIC NOT NULL CHECK (selling_price >= 0),
    storage_location TEXT,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    receiving_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receiving ENABLE ROW LEVEL SECURITY;

-- Allow all actions for authenticated users
DROP POLICY IF EXISTS "Allow all for auth users on suppliers" ON public.suppliers;
CREATE POLICY "Allow all for auth users on suppliers" 
    ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for auth users on purchase_orders" ON public.purchase_orders;
CREATE POLICY "Allow all for auth users on purchase_orders" 
    ON public.purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for auth users on purchase_order_items" ON public.purchase_order_items;
CREATE POLICY "Allow all for auth users on purchase_order_items" 
    ON public.purchase_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for auth users on goods_receiving" ON public.goods_receiving;
CREATE POLICY "Allow all for auth users on goods_receiving" 
    ON public.goods_receiving FOR ALL TO authenticated USING (true) WITH CHECK (true);
