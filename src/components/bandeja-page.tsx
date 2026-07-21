import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Inbox, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { myFlowInbox } from "@/lib/orders/flow.functions";
import { StatusBadge } from "@/components/flow/StatusBadge";
import { formatCurrency } from "@/lib/order-flow";

type PendingOrder = { id: string; order_number: string | null; status: string; total: number; pending_status: string | null; pending_holder_role: string | null; siigo_invoice_number: string | null; customer: { display_name: string } | null };
type ActiveOrder = { id: string; order_number: string | null; status: string; total: number; siigo_invoice_number: string | null; customer: { display_name: string } | null; updated_at: string };

export function BandejaPage() {
  const fetchInbox = useServerFn(myFlowInbox);
  const [pending, setPending] = useState<PendingOrder[]>([]);
  const [active, setActive] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetchInbox({})
      .then((r) => { setPending(r.pending as PendingOrder[]); setActive(r.active as ActiveOrder[]); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [fetchInbox]);

  useEffect(() => { load(); }, [load]);

  const term = q.trim().toLowerCase();
  const match = (o: { order_number: string | null; siigo_invoice_number: string | null; customer: { display_name: string } | null; id: string }) =>
    !term ||
    (o.order_number ?? "").toLowerCase().includes(term) ||
    (o.siigo_invoice_number ?? "").toLowerCase().includes(term) ||
    (o.customer?.display_name ?? "").toLowerCase().includes(term) ||
    o.id.slice(0, 8).includes(term);

  const pendingFiltered = useMemo(() => pending.filter(match), [pending, term]);
  const activeFiltered = useMemo(() => active.filter(match), [active, term]);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Inbox className="w-5 h-5" />
        <h1 className="text-xl font-bold flex-1">Mi bandeja</h1>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Actualizar</Button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por pedido, factura o cliente"
          className="pl-9"
        />
      </div>

      {loading ? <div className="grid place-items-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">Pendientes de aceptación ({pendingFiltered.length})</h2>
            {pendingFiltered.length === 0 ? <Card className="p-4 text-sm text-muted-foreground">Sin transferencias pendientes.</Card> : pendingFiltered.map((o) => (
              <Link key={o.id} to="/pedidos/$id" params={{ id: o.id }}>
                <Card className="p-3 hover:bg-accent transition">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{o.order_number ?? o.id.slice(0,8)} · {o.customer?.display_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{o.siigo_invoice_number ?? "Sin factura"} · pendiente {o.pending_status}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{formatCurrency(o.total)}</div>
                      <StatusBadge status={o.status} />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">Pedidos activos en mi área ({activeFiltered.length})</h2>
            {activeFiltered.length === 0 ? <Card className="p-4 text-sm text-muted-foreground">Sin pedidos activos.</Card> : activeFiltered.map((o) => (
              <Link key={o.id} to="/pedidos/$id" params={{ id: o.id }}>
                <Card className="p-3 hover:bg-accent transition">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{o.order_number ?? o.id.slice(0,8)} · {o.customer?.display_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{o.siigo_invoice_number ?? "Sin factura"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{formatCurrency(o.total)}</div>
                      <StatusBadge status={o.status} />
                    </div>
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
