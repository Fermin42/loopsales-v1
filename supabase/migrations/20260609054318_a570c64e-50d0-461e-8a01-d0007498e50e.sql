-- Tipos de novedad para vendedores (reemplazo de "Visitas")
INSERT INTO public.event_types (code, label, icon, active) VALUES
  ('inicio_ruta',    'Inicio de ruta',         'play',           true),
  ('fin_ruta',       'Fin de ruta',            'flag',           true),
  ('descanso',       'Descanso',               'coffee',         true),
  ('visita',         'Visita comercial',       'handshake',      true),
  ('cliente_abierto','Cliente abierto',        'door-open',      true),
  ('cliente_cerrado','Cliente cerrado',        'door-closed',    true),
  ('sin_pedido',     'Visita sin pedido',      'package-x',      true),
  ('reclamo',        'Reclamo / queja',        'alert-triangle', true),
  ('pago_recibido',  'Pago recibido',          'wallet',         true),
  ('novedad_otro',   'Otra novedad',           'sticky-note',    true)
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, icon = EXCLUDED.icon, active = true;