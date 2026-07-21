CREATE OR REPLACE VIEW public.product_reservations
WITH (security_invoker = true) AS
SELECT oi.product_id, COALESCE(SUM(oi.quantity), 0)::numeric AS reserved_qty
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
WHERE o.status NOT IN ('draft', 'pending', 'cancelled', 'voided', 'rejected')
GROUP BY oi.product_id;
GRANT SELECT ON public.product_reservations TO authenticated, service_role;