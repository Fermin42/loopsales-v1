import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Check, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { myQueue, respondHandoff } from "@/lib/handoffs/handoffs.functions";
import { StatusBadge } from "@/components/flow/StatusBadge";
import { ROLE_LABELS, type AppRole as FlowRole } from "@/lib/order-flow";

type Role = "bodega" | "conductor" | "facturacion" | "cartera";
type Pending = {
  id: string; order_id: string; from_role: string | null; notes: string | null; created_at: string;
  order: { id: string; order_number: string | null; status: string; total: number; siigo_invoice_number: string | null; customer: { display_name: string; address: string | null; phone: string | null } | null } | null;
};
type Active = {
  id: string; order_number: string | null; status: string; total: number; siigo_invoice_number: string | null;
  customer: { display_name: string; address: string | null; phone: string | null } | null;
};

function fmt(n: number) { return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(n) || 0); }

export function ColaPage() {
  const { roles } = useAuth();
  const myRoles = roles.filter((r): r is Role => ["bodega", "conductor", "facturacion", "cartera"].includes(r));
  const [role, setRole] = useState<Role | null>(null);
  useEffect(() => { if (myRoles.length > 0 && !role) setRole(myRoles[0]); }, [myRoles, role]);
  const initialRole = role ?? myRoles[0];

  const fetchQueue = useServerFn(myQueue);
  const respond = useServerFn(respondHandoff);
  const [pending, setPending] = useState<Pending[]>([]);
  const [active, setActive] = useState<Active[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = (r: Role) => {
    setLoading(true);
    fetchQueue({ data: { role: r } })
      .then((res) => { setPending(res.pending as unknown as Pending[]); setActive(res.active as unknown as Active[]); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (initialRole) load(initialRole); }, [initialRole]);

  const act = async (handoffId: string, decision: "accept" | "reject") => {
    setBusy(handoffId);
    try {
      await respond({ data: { handoff_id: handoffId, decision, reject_reason: decision === "reject" ? "Rechazado" : undefined } });
      toast.success("Listo"); if (initialRole) load(initialRole);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
    setBusy(null);
  };

  if (myRoles.length === 0) {
    return <div className="p-6 text-center text-muted-foreground">No tienes roles operativos asignados (bodega, conductor, facturación o cartera).</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <div className="text-xs text-muted-foreground">Mi cola</div>
        <div className="font-semibold text-xl">{ROLE_LABELS[initialRole as FlowRole] ?? initialRole}</div>
      </div>

      {myRoles.length > 1 && (
        <Tabs value={initialRole} onValueChange={(v) => { setRole(v as Role); load(v as Role); }}>
          <TabsList className="w-full grid grid-flow-col">
            {myRoles.map((r) => <TabsTrigger key={r} value={r}>{ROLE_LABELS[r as FlowRole] ?? r}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      )}

      {loading ? <div className="grid place-items-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> : (
        <>
          <section className="space-y-2">
            <h2 className="font-semibold">Pendientes de aceptar ({pending.length})</h2>
            {pending.length === 0 && <Card className="p-4 text-sm text-muted-foreground">Sin pendientes</Card>}
            {pending.map((p) => (
              <Card key={p.id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground truncate">
                      {p.order?.siigo_invoice_number ? `Factura ${p.order.siigo_invoice_number}` : `Pedido ${p.order?.order_number ?? p.order?.id?.slice(0, 8)}`}
                    </div>
                    <div className="font-medium truncate">{p.order?.customer?.display_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">{fmt(p.order?.total ?? 0)} · de {ROLE_LABELS[(p.from_role ?? "") as FlowRole] ?? p.from_role}</div>
                    {p.notes && <div className="text-xs italic">"{p.notes}"</div>}
                  </div>
                  {p.order && <StatusBadge status={p.order.status} />}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy === p.id} onClick={() => act(p.id, "accept")}><Check className="w-4 h-4 mr-1" />Aceptar</Button>
                  <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => act(p.id, "reject")}><X className="w-4 h-4 mr-1" />Rechazar</Button>
                  {p.order && <Link to="/pedidos/$id" params={{ id: p.order.id }}><Button size="sm" variant="ghost"><ArrowRight className="w-4 h-4" /></Button></Link>}
                </div>
              </Card>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">En curso ({active.length})</h2>
            {active.length === 0 && <Card className="p-4 text-sm text-muted-foreground">Nada en curso</Card>}
            {active.map((o) => (
              <Link key={o.id} to="/pedidos/$id" params={{ id: o.id }}>
                <Card className="p-3 hover:bg-accent/30 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground truncate">
                        {o.siigo_invoice_number ? `Factura ${o.siigo_invoice_number}` : `Pedido ${o.order_number ?? o.id.slice(0, 8)}`}
                      </div>
                      <div className="font-medium truncate">{o.customer?.display_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">{fmt(o.total)}</div>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                </Card>
              </Link>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
