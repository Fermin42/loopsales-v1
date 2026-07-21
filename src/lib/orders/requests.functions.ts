// Solicitudes de anulación o devolución de pedidos.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { attachAuthHeader } from "@/lib/auth-client-middleware";
import { SiigoClient, SiigoApiError } from "@/lib/siigo/client.server";

type AppRole = "admin" | "vendedor" | "facturacion" | "cartera" | "bodega" | "conductor";
const REQUESTABLE_STATUSES = new Set(["pending", "confirmed", "invoiced", "in_warehouse", "in_transit", "dispatched", "pending_acceptance"]);
async function rolesOf(uid: string): Promise<AppRole[]> {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", uid);
  return ((data ?? []) as Array<{ role: AppRole }>).map((r) => r.role);
}
const has = (rs: AppRole[], r: AppRole | AppRole[]) => (Array.isArray(r) ? r.some((x) => rs.includes(x)) : rs.includes(r));

async function notify(user_id: string, type: string, title: string, body: string | null, order_id: string | null) {
  await supabaseAdmin.from("notifications").insert({ user_id, type, title, body, order_id });
}
async function notifyRoles(roles: AppRole[], type: string, title: string, body: string | null, order_id: string | null) {
  const { data } = await supabaseAdmin.from("user_roles").select("user_id").in("role", roles as readonly ("admin" | "bodega" | "cartera" | "conductor" | "facturacion" | "vendedor")[]);
  const seen = new Set<string>();
  for (const r of (data ?? []) as Array<{ user_id: string }>) {
    if (seen.has(r.user_id)) continue;
    seen.add(r.user_id);
    await notify(r.user_id, type, title, body, order_id);
  }
}

async function addTrace(order_id: string, actor_id: string, actor_role: AppRole, status: string, text: string) {
  const { data } = await supabaseAdmin.from("order_events").insert({
    order_id,
    event_type: "admin_edit",
    from_status: status,
    to_status: status,
    actor_id,
    actor_role,
    observations: text,
  } as never).select("id").single();
  return (data as { id: string } | null)?.id ?? null;
}

export const createOrderRequest = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    order_id: z.string().uuid(),
    type: z.enum(["cancel", "return"]),
    reason: z.string().trim().min(3).max(2000),
    photo_urls: z.array(z.string().url()).optional(),
    lat: z.number().nullable().optional(),
    lng: z.number().nullable().optional(),
    accuracy: z.number().nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: order } = await supabaseAdmin.from("orders")
      .select("id, order_number, seller_id, status, current_holder_user, current_holder_role, customer:customers(display_name)")
      .eq("id", data.order_id).maybeSingle();
    if (!order) throw new Error("Pedido no encontrado");
    const rs = await rolesOf(context.userId);
    const owner = order.seller_id === context.userId;
    const holder = order.current_holder_user === context.userId;
    if (!REQUESTABLE_STATUSES.has(order.status)) throw new Error("En este estado no se puede solicitar anulación o devolución");
    if (!owner && !holder && !has(rs, ["admin", "facturacion", "bodega", "conductor"])) throw new Response("Forbidden", { status: 403 });
    const { data: pending } = await supabaseAdmin.from("order_requests")
      .select("id").eq("order_id", data.order_id).eq("status", "pending").maybeSingle();
    if (pending) throw new Error("Este pedido ya tiene una solicitud pendiente");
    const { error } = await supabaseAdmin.from("order_requests").insert({
      order_id: data.order_id, requested_by: context.userId,
      type: data.type, reason: data.reason, status: "pending",
    });
    if (error) throw new Error(error.message);

    // Notificar a admin + facturación: tienen que revisar la solicitud
    const rawCust = (order as unknown as { customer?: unknown }).customer;
    const cust = (Array.isArray(rawCust) ? rawCust[0] : rawCust) as { display_name?: string } | null | undefined;
    const label = data.type === "cancel" ? "anulación" : "devolución";
    const title = `Solicitud de ${label} pendiente`;
    const body = `${cust?.display_name ?? "Cliente"} · ${order.order_number ?? data.order_id.slice(0, 8)} · ${data.reason.slice(0, 120)}`;
    const evId = await addTrace(data.order_id, context.userId, has(rs, "vendedor") ? "vendedor" : (rs[0] ?? "vendedor"), order.status, `Solicitud de ${label}: ${data.reason}`);
    if (evId && data.photo_urls?.length) {
      await supabaseAdmin.from("order_evidences").insert(data.photo_urls.map((url, i) => ({
        event_id: evId,
        order_id: data.order_id,
        file_url: url,
        file_name: `request-${i + 1}.jpg`,
        file_type: "image/jpeg",
        uploaded_by: context.userId,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        accuracy: data.accuracy ?? null,
        location_captured_at: data.lat ? new Date().toISOString() : null,
      })) as never);
    }
    await notifyRoles(["admin", "facturacion"], "order_request_created", title, body, data.order_id);
    if (!owner) await notify(order.seller_id, "order_request_created", title, body, data.order_id);
    return { ok: true };
  });

export const listOrderRequests = createServerFn({ method: "GET" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    status: z.enum(["pending", "approved", "rejected"]).optional(),
    order_id: z.string().uuid().optional(),
  }).parse(input ?? {}))
  .handler(async ({ data }) => {
    let q = supabaseAdmin.from("order_requests")
      .select("id, order_id, requested_by, type, reason, status, reviewed_by, reviewed_at, reviewer_notes, created_at, order:orders(id, order_number, total, status, siigo_invoice_id, siigo_invoice_number, customer:customers(display_name)), requester:profiles!order_requests_requested_by_fkey(full_name, email)")
      .order("created_at", { ascending: false });
    if (data?.status) q = q.eq("status", data.status);
    if (data?.order_id) q = q.eq("order_id", data.order_id);
    const { data: rows, error } = await q;
    if (error) {
      // Sin FK declarada al perfil — fallback simple
      const fallback = await supabaseAdmin.from("order_requests")
        .select("id, order_id, requested_by, type, reason, status, reviewed_by, reviewed_at, reviewer_notes, created_at, order:orders(id, order_number, total, status, siigo_invoice_id, siigo_invoice_number, customer:customers(display_name))")
        .order("created_at", { ascending: false });
      return { requests: fallback.data ?? [] };
    }
    return { requests: rows ?? [] };
  });

export const reviewOrderRequest = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid(),
    decision: z.enum(["approve", "reject"]),
    notes: z.string().max(2000).optional(),
    credit_note_number: z.string().trim().max(80).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const rs = await rolesOf(context.userId);
    if (!has(rs, ["admin", "facturacion"])) throw new Response("Forbidden", { status: 403 });
    const { data: req } = await supabaseAdmin.from("order_requests")
      .select("*, order:orders(id, status, siigo_invoice_id, seller_id, order_number, current_holder_user, current_holder_role)")
      .eq("id", data.id).maybeSingle();
    if (!req) throw new Error("Solicitud no encontrada");
    if (req.status !== "pending") throw new Error("Solicitud ya procesada");

    const newStatus = data.decision === "approve" ? "approved" : "rejected";
    const { error: uErr } = await supabaseAdmin.from("order_requests").update({
      status: newStatus, reviewed_by: context.userId, reviewed_at: new Date().toISOString(),
      reviewer_notes: data.notes ?? null,
    }).eq("id", req.id);
    if (uErr) throw new Error(uErr.message);

    if (data.decision === "approve") {
      const order = req.order as unknown as {
        id: string; status: string; siigo_invoice_id: string | null;
        seller_id: string; order_number: string | null;
        current_holder_user: string | null; current_holder_role: string | null;
      } | null;
      if (!order) throw new Error("Pedido no encontrado");
      // Si tiene factura, intentar emitir nota crédito en Siigo (best-effort)
      let creditNoteId: string | null = null;
      let creditNoteNumber: string | null = data.credit_note_number?.trim() || null;
      if (order.siigo_invoice_id && !creditNoteNumber) {
        throw new Error("Incluye el consecutivo de Nota Crédito para aprobar una factura ya emitida");
      }
      if (order.siigo_invoice_id) {
        try {
          const cn = await SiigoClient.request<{ id: string; name?: string; number?: number }>({
            method: "POST", path: "/v1/credit-notes",
            body: { invoice: order.siigo_invoice_id, reason: req.reason ?? "Anulación" },
          });
          creditNoteId = cn.id;
          creditNoteNumber = cn.name ?? (cn.number != null ? String(cn.number) : null) ?? creditNoteNumber;
        } catch (e) {
          if (e instanceof SiigoApiError) {
            // No bloqueamos, registramos en void_reason
          }
        }
      }
      await supabaseAdmin.from("orders").update({
        status: order.siigo_invoice_id ? "returned_to_billing" : "voided",
        voided_at: new Date().toISOString(),
        void_reason: `${req.type === "cancel" ? "Anulación" : "Devolución"} aprobada${creditNoteNumber ? ` · NC ${creditNoteNumber}` : ""}: ${req.reason ?? ""}`.slice(0, 500),
        siigo_credit_note_id: creditNoteId,
        siigo_credit_note_number: creditNoteNumber,
        // Si ya tenía factura, regresa a facturación para cerrar la NC; si no, sale del flujo.
        current_holder_user: order.siigo_invoice_id ? null : null,
        current_holder_role: order.siigo_invoice_id ? "facturacion" : null,
        pending_status: null,
        pending_holder_user: null,
        pending_holder_role: null,
      }).eq("id", order.id);
      const approverRole: AppRole = rs.includes("facturacion") ? "facturacion" : rs.includes("admin") ? "admin" : rs[0];
      await addTrace(order.id, context.userId, approverRole, order.siigo_invoice_id ? "returned_to_billing" : "voided", `${req.type === "cancel" ? "Anulación" : "Devolución"} aprobada${creditNoteNumber ? ` · NC ${creditNoteNumber}` : ""}${data.notes ? ` · ${data.notes}` : ""}`);

      // Notificaciones: vendedor, holder actual, solicitante y cartera (queda finalizado/anulado)
      const label = req.type === "cancel" ? "Pedido anulado" : "Devolución aprobada";
      const msg = `${order.order_number ?? order.id.slice(0, 8)} ${data.notes ? "· " + data.notes.slice(0, 120) : ""}`.trim();
      const targets = new Set<string>();
      targets.add(order.seller_id);
      if (req.requested_by) targets.add(req.requested_by);
      if (order.current_holder_user) targets.add(order.current_holder_user);
      for (const uid of targets) {
        await notify(uid, "order_request_approved", label, msg, order.id);
      }
      // Avisar a facturación/cartera para que lo saquen de su bandeja
      await notifyRoles(["facturacion", "cartera", "bodega", "conductor"], "order_request_approved", label, msg, order.id);
    } else {
      const order = req.order as unknown as { id: string; seller_id: string; order_number: string | null } | null;
      if (order) {
        const msg = `${order.order_number ?? order.id.slice(0, 8)}${data.notes ? " · " + data.notes.slice(0, 120) : ""}`;
        await addTrace(order.id, context.userId, rs.includes("facturacion") ? "facturacion" : "admin", "rejected", `Solicitud rechazada: ${data.notes ?? "Sin notas"}`);
        const targets = new Set<string>([order.seller_id, req.requested_by].filter(Boolean) as string[]);
        for (const uid of targets) {
          await notify(uid, "order_request_rejected", "Solicitud rechazada", msg, order.id);
        }
      }
    }
    return { ok: true };
  });