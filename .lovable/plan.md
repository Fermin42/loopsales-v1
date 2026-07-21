# Plan de mejoras

Voy a atacar los 7 puntos. Aquí el resumen y algunas decisiones que necesito confirmar antes de codear (marcadas ⚠️).

## 1. Aprobación de clientes: mostrar vendedor que solicita
En `admin/clientes-pendientes.tsx`, agregar columna/campo "Solicitado por" resolviendo `created_by` → `profiles.full_name` / email. También mostrarlo dentro del modal de aprobación.

## 2. Rate limit de Siigo al crear clientes
Siigo limita ~15 req/min y devuelve 429. Voy a:
- Añadir en `siigo/client.server.ts` un helper `siigoFetchWithRetry` que:
  - respete el header `Retry-After` en 429,
  - haga backoff exponencial (hasta 3 reintentos),
  - serialice las llamadas de creación de clientes con una cola simple (mutex en memoria) para evitar ráfagas simultáneas cuando el admin aprueba varias.
- Aplicarlo en la creación de cliente Siigo.

## 3. Envío de `city_code` mal formado
La API de Siigo espera `address.city.city_code` como el código puro (ej. `"11001"`) con `state_code` (`"11"`) y `country_code` (`"CO"`, no `"COL"` — ⚠️ **el código oficial de Siigo para Colombia es `"CO"`, corrijo eso**). Voy a:
- Verificar el catálogo en `siigo-cities.generated.ts` y ajustar `country_code` a `"CO"`.
- Revisar el payload en la función que crea cliente en Siigo para enviar exactamente `{ country_code, state_code, city_code }` sin concatenaciones raras.
- Log del payload en caso de error 400 para diagnóstico futuro.

## 4. Reportes con gráficos + export a Excel con gráfico
- Añadir gráficos en la UI de `admin/reportes.tsx` usando `recharts` (barras/línea para ventas por día, top productos, por vendedor).
- Para el Excel con gráfico nativo: `xlsx` (SheetJS community) **no soporta escribir gráficos**. Opciones:
  - (a) usar `exceljs` que sí soporta gráficos nativos de Excel,
  - (b) incrustar los gráficos como **imágenes PNG** (renderizadas desde recharts a canvas) dentro del xlsx con `exceljs`.
  
  ⚠️ Voy a ir con **opción (b) + exceljs**: da resultado visual consistente y funciona en el runtime del navegador. Reemplaza `xlsx` por `exceljs` en `export-excel.ts`.

## 5. Botón "Solicitar anulación": solo vendedor, solo hasta facturación
- En `OrderFlowSection.tsx` (o donde se muestre el botón): condicionar visibilidad a `roles.includes("vendedor")` **y** `status ∈ {pending, confirmed}` (excluye `invoiced` y posteriores).
- Admin conserva sus acciones administrativas por su lado.

## 6. Timeline: etiquetas legibles + versión resumida para vendedor
- Renombrar en `order-flow.ts`:
  - "warehouse" → "Bodega"
  - "bill_to_warehouse" → "Enviado a Bodega"
  - "warehouse_to_driver" → "Bodega → Conductor" → **"Enviado a Reparto"**
  - "driver_delivers_customer" → "Entregado al cliente"
  - etc. (paso por todos los EVENT_LABELS y STATUS_LABELS quitando anglicismos)
- Nuevo componente `FlowTimelineCompact.tsx` para vendedores: solo `cuándo` + `a dónde pasó` (sin nombres ni roles). Usarlo en las vistas del vendedor; admin/otros roles siguen viendo el detallado.

## 7. Mapa de clientes con rutas y colores por día
Este es el más grande. Propuesta:

**Mapa gratis**: uso **Leaflet + OpenStreetMap tiles** (100% gratis, sin API key). Se carga solo en cliente (`<ClientOnly>` + `React.lazy`).

**Modelo de datos** (nueva migración):
- Tabla `customer_routes`: `id, seller_id, name, color, day_of_week (0-6 o null), created_at`.
- Columna `route_id uuid null` en `customers` (FK a `customer_routes`).
- Grants + RLS: vendedor lee/edita sus rutas y asigna clientes propios; admin ve todo.

**Nueva ruta**: `/_authenticated/mapa` (visible en menú para admin, vendedor, facturacion, bodega, conductor).
- Vendedor: ve solo sus clientes (pin coloreado por su ruta/día).
- Admin: ve todos, con filtro por vendedor, y en el popup muestra "Vendedor: X".
- Facturación/Bodega/Conductor: ven todos los clientes con ubicación (solo lectura), útil para planear entrega.
- Panel lateral: CRUD de rutas (nombre, color, día) solo para vendedor y admin. Botón "Asignar a ruta" desde el popup del pin.

**Colores**: paleta fija de 7 (uno por día) + colores custom por ruta. Pin usa color de la ruta asignada; si no tiene ruta, gris.

---

## Confirmaciones que necesito
1. **Excel con gráficos**: ¿ok reemplazar `xlsx` por `exceljs` e incrustar gráficos como imagen? (alternativa: mantener xlsx y solo tener gráficos en la UI web, no en el archivo).
2. **Mapa**: ¿ok Leaflet + OpenStreetMap (gratis, sin key)? Si prefieres Google Maps, tendrías que activar el conector (tiene cuota gratis pero requiere cuenta Google con billing).
3. **Country code Siigo**: confirmo con la doc que Siigo usa `"CO"` (2 letras ISO). Voy con eso salvo que tengas otro dato.

Con eso confirmado, procedo a implementar todo en un solo turno.
