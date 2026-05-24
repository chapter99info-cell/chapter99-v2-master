-- Service add-ons for POS (Owner Settings + bill line items)
-- Safe to re-run: drops old policy names before creating "Shop access"

CREATE TABLE IF NOT EXISTS service_addons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_addons_shop_id_idx ON service_addons(shop_id);

ALTER TABLE service_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_addons_access" ON service_addons;
DROP POLICY IF EXISTS "Shop access" ON service_addons;

CREATE POLICY "Shop access" ON service_addons
  FOR ALL
  USING (true)
  WITH CHECK (true);
