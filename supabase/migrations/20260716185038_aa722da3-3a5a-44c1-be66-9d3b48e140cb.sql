
-- Rutas de clientes por vendedor: nombre, color y (opcional) día de la semana.
CREATE TABLE public.customer_routes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  day_of_week smallint NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_routes TO authenticated;
GRANT ALL ON public.customer_routes TO service_role;
ALTER TABLE public.customer_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seller manages own routes" ON public.customer_routes FOR ALL TO authenticated
  USING (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "all staff can read routes" ON public.customer_routes FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','vendedor','facturacion','bodega','conductor','cartera']::app_role[]));

CREATE TRIGGER trg_customer_routes_updated
  BEFORE UPDATE ON public.customer_routes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Vincular cliente a ruta (opcional).
ALTER TABLE public.customers ADD COLUMN route_id uuid NULL REFERENCES public.customer_routes(id) ON DELETE SET NULL;
ALTER TABLE public.customers ADD COLUMN assigned_seller_user uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX idx_customers_route ON public.customers(route_id);
CREATE INDEX idx_customers_assigned_seller ON public.customers(assigned_seller_user);
