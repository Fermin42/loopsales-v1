import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, ListChecks, Search } from "lucide-react";
import { toast } from "sonner";
import { listOrders } from "@/lib/orders/orders.functions";

export const Route = createFileRoute("/_authenticated/vendedor/pedidos")({
  component: MisPedidosPage,
});

type OrderRow = {
  id: string; status: string; total: number;
  delivery_date: string | null; due_date: string | null;
  has_manual_price: boolean; manual_price_acknowledged: boolean;
  siigo_invoice_number: string | null;
  created_at: string;
  customer: { display_name: string; identification: string } | null;
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

const LABEL: Record<string, string> = {
  draft: "Borrador", pending: "Pendiente", confirmed: "Confirmado",
  invoiced: "Facturado", dispatched: "Reparto", cancelled: "Cancelado",
};

const STATUS_OPTIONS = ["all", "draft", "pending", "confirmed", "invoiced", "dispatched", "cancelled"] as const;

function MisPedidosPage() {
  const fetchList = useServerFn(listOrders);
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  useEffect(() => {
    fetchList({ data: { scope: "mine", limit: 100 } })
      .then((r) => setRows(r.orders as unknown as OrderRow[]))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error cargando pedidos"))
      .finally(() => setLoading(false));
  }, [fetchList]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (!term) return true;
      return (
        (o.customer?.display_name ?? "").toLowerCase().includes(term) ||
        (o.customer?.identification ?? "").toLowerCase().includes(term) ||
        (o.siigo_invoice_number ?? "").toLowerCase().includes(term) ||
        o.id.slice(0, 8).includes(term)
      );
    });
  }, [rows, q, status]);

  if (loading) return <div className="grid place-items-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Mis pedidos</h1>
        <Link to="/vendedor/nuevo"><Button size="sm"><Plus className="w-4 h-4 mr-1" />Nuevo</Button></Link>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cliente, NIT o factura"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s === "all" ? "Todos" : LABEL[s] ?? s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} de {rows.length}</div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <ListChecks className="w-8 h-8 mx-auto mb-2 opacity-50" />
          {rows.length === 0 ? "Aún no tienes pedidos. Crea el primero." : "Sin resultados para tu búsqueda."}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => (
            <Link key={o.id} to="/pedidos/$id" params={{ id: o.id }}>
              <Card className="p-3 hover:bg-accent/30 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{o.customer?.display_name ?? "Cliente"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                      {o.siigo_invoice_number ? ` · Factura ${o.siigo_invoice_number}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {o.delivery_date ? `Entrega: ${o.delivery_date}` : "Sin entrega"}
                      {o.due_date ? ` · Vence: ${o.due_date}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{fmt(Number(o.total))}</div>
                    <Badge variant="secondary" className="mt-1 text-xs">{LABEL[o.status] ?? o.status}</Badge>
                    {o.has_manual_price && !o.manual_price_acknowledged && (
                      <Badge variant="outline" className="ml-1 mt-1 text-[10px]">Ajustado</Badge>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
