CREATE TABLE IF NOT EXISTS public.seller_sequences (user_id uuid PRIMARY KEY, prefix text NOT NULL DEFAULT '', next_consecutive integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_sequences TO authenticated;
GRANT ALL ON public.seller_sequences TO service_role;
ALTER TABLE public.seller_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY seller_seq_admin_all ON public.seller_sequences FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY seller_seq_select_own_or_staff ON public.seller_sequences FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','facturacion','cartera','bodega','conductor']::app_role[]));
CREATE TRIGGER trg_seller_sequences_updated BEFORE UPDATE ON public.seller_sequences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_prefix text, ADD COLUMN IF NOT EXISTS order_consecutive integer, ADD COLUMN IF NOT EXISTS order_number text, ADD COLUMN IF NOT EXISTS created_lat numeric, ADD COLUMN IF NOT EXISTS created_lng numeric, ADD COLUMN IF NOT EXISTS created_geo_accuracy numeric, ADD COLUMN IF NOT EXISTS voided_at timestamptz, ADD COLUMN IF NOT EXISTS void_reason text, ADD COLUMN IF NOT EXISTS siigo_credit_note_id text, ADD COLUMN IF NOT EXISTS siigo_credit_note_number text, ADD COLUMN IF NOT EXISTS current_holder_user uuid, ADD COLUMN IF NOT EXISTS current_holder_role app_role;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS geo_lat numeric, ADD COLUMN IF NOT EXISTS geo_lng numeric, ADD COLUMN IF NOT EXISTS geo_captured_at timestamptz;

CREATE TABLE IF NOT EXISTS public.order_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL, requested_by uuid NOT NULL, type text NOT NULL CHECK (type IN ('cancel','return')), reason text, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')), reviewed_by uuid, reviewed_at timestamptz, reviewer_notes text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_requests TO authenticated;
GRANT ALL ON public.order_requests TO service_role;
ALTER TABLE public.order_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY or_select_owner_or_staff ON public.order_requests FOR SELECT TO authenticated USING (requested_by = auth.uid() OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.seller_id = auth.uid()) OR public.has_any_role(auth.uid(), ARRAY['admin','facturacion']::app_role[]));
CREATE POLICY or_insert_owner_or_staff ON public.order_requests FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid() AND (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.seller_id = auth.uid()) OR public.has_any_role(auth.uid(), ARRAY['admin','facturacion']::app_role[])));
CREATE POLICY or_update_admin_billing ON public.order_requests FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','facturacion']::app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','facturacion']::app_role[]));

CREATE TABLE IF NOT EXISTS public.event_types (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, label text NOT NULL, icon text, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_types TO authenticated;
GRANT ALL ON public.event_types TO service_role;
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY et_select_auth ON public.event_types FOR SELECT TO authenticated USING (true);
CREATE POLICY et_admin_write ON public.event_types FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.event_types (code, label, icon) VALUES ('ruta_inicio','Inicio de ruta','Play'),('ruta_fin','Fin de ruta','Square'),('visita','Visita','MapPin'),('pedido_inicio','Inicio de pedido','ShoppingCart'),('nota','Nota','StickyNote') ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.customer_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL, created_by uuid NOT NULL, event_type text NOT NULL, notes text, lat numeric, lng numeric, accuracy numeric, photo_url text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_events TO authenticated;
GRANT ALL ON public.customer_events TO service_role;
ALTER TABLE public.customer_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ce_select_creator_or_staff ON public.customer_events FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','facturacion','cartera','bodega','conductor']::app_role[]));
CREATE POLICY ce_insert_authenticated ON public.customer_events FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY ce_delete_admin ON public.customer_events FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.order_handoffs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL, from_user uuid, from_role app_role, to_user uuid, to_role app_role NOT NULL, action text NOT NULL CHECK (action IN ('send','accept','reject','deliver_customer')), status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','completed')), notes text, reject_reason text, lat numeric, lng numeric, accuracy numeric, photo_url text, signature_url text, responded_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_handoffs TO authenticated;
GRANT ALL ON public.order_handoffs TO service_role;
ALTER TABLE public.order_handoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY oh_select_staff_or_seller ON public.order_handoffs FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','facturacion','cartera','bodega','conductor']::app_role[]) OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.seller_id = auth.uid()));
CREATE POLICY oh_insert_staff ON public.order_handoffs FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','facturacion','cartera','bodega','conductor']::app_role[]));
CREATE POLICY oh_update_staff ON public.order_handoffs FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','facturacion','cartera','bodega','conductor']::app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','facturacion','cartera','bodega','conductor']::app_role[]));

CREATE OR REPLACE FUNCTION public.assign_order_number(_seller_id uuid) RETURNS TABLE(prefix text, consecutive integer, order_number text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE v_prefix text; v_next int; BEGIN INSERT INTO public.seller_sequences (user_id, prefix, next_consecutive) VALUES (_seller_id, '', 1) ON CONFLICT (user_id) DO NOTHING; UPDATE public.seller_sequences AS s SET next_consecutive = s.next_consecutive + 1, updated_at = now() WHERE s.user_id = _seller_id RETURNING s.prefix, s.next_consecutive - 1 INTO v_prefix, v_next; RETURN QUERY SELECT v_prefix, v_next, CASE WHEN coalesce(v_prefix,'') = '' THEN v_next::text ELSE v_prefix || '-' || v_next::text END; END; $$;