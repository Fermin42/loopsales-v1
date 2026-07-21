// Rutas de clientes por vendedor + endpoints para el mapa.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { attachAuthHeader } from "@/lib/auth-client-middleware";

async function getRoles(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}

// ---- Rutas CRUD ----
export const listRoutes = createServerFn({ method: "GET" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const roles = await getRoles(context.userId);
    const isAdmin = roles.includes("admin");
    let q = supabaseAdmin.from("customer_routes").select("id, seller_id, name, color, day_of_week, created_at").order("name");
    if (!isAdmin) q = q.eq("seller_id", context.userId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    // Cargar nombres de vendedor para admin
    const sellerIds = Array.from(new Set((data ?? []).map((r) => r.seller_id)));
    const nameMap = new Map<string, string>();
    if (isAdmin && sellerIds.length > 0) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", sellerIds);
      for (const p of profs ?? []) nameMap.set(p.id, p.full_name || p.email || p.id.slice(0, 8));
    }
    return { routes: (data ?? []).map((r) => ({ ...r, seller_name: nameMap.get(r.seller_id) ?? null })) };
  });

const RouteSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).default("#3B82F6"),
  day_of_week: z.number().int().min(0).max(6).nullable().optional(),
});

export const saveRoute = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((i: unknown) => RouteSchema.parse(i))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await supabaseAdmin.from("customer_routes")
        .update({ name: data.name, color: data.color, day_of_week: data.day_of_week ?? null })
        .eq("id", data.id)
        .eq("seller_id", context.userId);
      if (error) throw new Error(error.message);
      return { ok: true as const, id: data.id };
    }
    const { data: inserted, error } = await supabaseAdmin.from("customer_routes")
      .insert({ seller_id: context.userId, name: data.name, color: data.color, day_of_week: data.day_of_week ?? null })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: inserted.id };
  });

export const deleteRoute = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin.from("customer_routes")
      .delete().eq("id", data.id).eq("seller_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---- Asignar ruta a cliente ----
export const assignCustomerRoute = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    customer_id: z.string().uuid(),
    route_id: z.string().uuid().nullable(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const roles = await getRoles(context.userId);
    const isAdmin = roles.includes("admin");
    // Un vendedor solo puede asignar rutas que le pertenezcan.
    if (data.route_id && !isAdmin) {
      const { data: r } = await supabaseAdmin.from("customer_routes").select("seller_id").eq("id", data.route_id).maybeSingle();
      if (!r || r.seller_id !== context.userId) throw new Error("Esa ruta no te pertenece");
    }
    const patch: { route_id: string | null; assigned_seller_user?: string } = { route_id: data.route_id };
    // Al asignar por primera vez, marcamos el vendedor asignado
    if (data.route_id && !isAdmin) patch.assigned_seller_user = context.userId;
    const { error } = await supabaseAdmin.from("customers").update(patch).eq("id", data.customer_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---- Datos para el mapa ----
type MapCustomer = {
  id: string;
  display_name: string;
  identification: string;
  address: string | null;
  city_name: string | null;
  phone: string | null;
  geo_lat: number;
  geo_lng: number;
  route_id: string | null;
  assigned_seller_user: string | null;
  assigned_seller_name?: string | null;
};

export const listMapCustomers = createServerFn({ method: "GET" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ seller_filter: z.string().uuid().nullable().optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const roles = await getRoles(context.userId);
    const isAdmin = roles.includes("admin");
    const isSeller = roles.includes("vendedor");

    let q = supabaseAdmin
      .from("customers")
      .select("id, display_name, identification, address, city_name, phone, geo_lat, geo_lng, route_id, assigned_seller_user, created_by_user")
      .not("geo_lat", "is", null)
      .not("geo_lng", "is", null)
      .limit(2000);

    // Vendedor puro (sin admin): solo sus clientes.
    if (isSeller && !isAdmin) {
      q = q.or(`assigned_seller_user.eq.${context.userId},created_by_user.eq.${context.userId}`);
    }
    if (data.seller_filter && isAdmin) {
      q = q.or(`assigned_seller_user.eq.${data.seller_filter},created_by_user.eq.${data.seller_filter}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const customers = (rows ?? []).filter((r) => r.geo_lat != null && r.geo_lng != null) as unknown as Array<MapCustomer & { created_by_user: string | null }>;
    // Nombres de vendedor para admins
    const nameMap = new Map<string, string>();
    if (isAdmin) {
      const ids = Array.from(new Set(customers.flatMap((c) => [c.assigned_seller_user, c.created_by_user]).filter(Boolean))) as string[];
      if (ids.length > 0) {
        const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids);
        for (const p of profs ?? []) nameMap.set(p.id, p.full_name || p.email || p.id.slice(0, 8));
      }
    }
    const enriched: MapCustomer[] = customers.map((c) => ({
      id: c.id,
      display_name: c.display_name,
      identification: c.identification,
      address: c.address,
      city_name: c.city_name,
      phone: c.phone,
      geo_lat: c.geo_lat,
      geo_lng: c.geo_lng,
      route_id: c.route_id,
      assigned_seller_user: c.assigned_seller_user ?? c.created_by_user ?? null,
      assigned_seller_name: nameMap.get(c.assigned_seller_user ?? c.created_by_user ?? "") ?? null,
    }));

    // Todas las rutas visibles al usuario
    let routesQ = supabaseAdmin.from("customer_routes").select("id, seller_id, name, color, day_of_week");
    if (!isAdmin) routesQ = routesQ.eq("seller_id", context.userId);
    const { data: routesData } = await routesQ;

    return { customers: enriched, routes: routesData ?? [] };
  });

// Lista de vendedores (para filtro admin)
export const listSellersForMap = createServerFn({ method: "GET" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const roles = await getRoles(context.userId);
    if (!roles.includes("admin")) return { sellers: [] };
    const { data: userRoles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "vendedor");
    const ids = Array.from(new Set((userRoles ?? []).map((r) => r.user_id)));
    if (ids.length === 0) return { sellers: [] };
    const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids);
    return { sellers: (profs ?? []).map((p) => ({ id: p.id, name: p.full_name || p.email || p.id.slice(0, 8) })) };
  });
