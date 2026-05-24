CREATE TABLE IF NOT EXISTS service_addons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE service_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop_addons_access" ON service_addons FOR ALL USING (true);
