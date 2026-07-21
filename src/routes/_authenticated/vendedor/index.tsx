import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Plus, ListChecks, Users, Package, Inbox, ShoppingBag, Loader2, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { listOrders } from "@/lib/orders/orders.functions";
import { myFlowInbox } from "@/lib/orders/flow.functions";
import { formatCurrency } from "@/lib/order-flow";

export const Route = createFileRoute("/_authenticated/vendedor/")({
  component: HomePage,
});

type OrderRow = { id: string; status: string; total: number; created_at: string; customer: { display_name: string } | null };

function HomePage() {
  const { hasRole, user } = useAuth();
  const isOperativo = !hasRole("vendedor") && !hasRole("admin") && (hasRole("bodega") || hasRole("conductor"));
  if (isOperativo) return <OperativoHome />;
  return <VendedorHome />;
}

function VendedorHome() {
  const fetchList = useServerFn(listOrders);
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchList({ data: { scope: "mine", limit: 50 } })
      .then((r) => setRows(r.orders as unknown as OrderRow[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchList]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todays = rows.filter((o) => new Date(o.created_at) >= today);
  const pendientes = rows.filter((o) => ["draft", "pending"].includes(o.status));
  const ventasMes = rows
    .filter((o) => o.status !== "cancelled" && new Date(o.created_at).getMonth() === new Date().getMonth())
    .reduce((s, o) => s + Number(o.total || 0), 0);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Hola 👋</h1>
        <p className="text-sm text-muted-foreground">Bienvenido a tu panel de ventas</p>
      </div>

      {loading ? (
        <div className="grid place-items-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Hoy" value={String(todays.length)} sub="pedidos" />
          <StatCard label="Pendientes" value={String(pendientes.length)} sub="por confirmar" />
          <StatCard label="Mes" value={formatCurrency(ventasMes)} sub="ventas" />
        </div>
      )}

      <Link to="/vendedor/nuevo">
        <Card className="p-5 flex items-center gap-3 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0 shadow-md">
          <div className="w-12 h-12 rounded-full bg-white/20 grid place-items-center">
            <Plus className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Crear nuevo pedido</div>
            <div className="text-xs opacity-90">Selecciona cliente y agrega productos</div>
          </div>
        </Card>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <QuickLink to="/vendedor/pedidos" icon={ListChecks} label="Mis pedidos" sub="historial y estado" />
        <QuickLink to="/vendedor/clientes" icon={Users} label="Mis clientes" sub="ver y registrar" />
        <QuickLink to="/vendedor/productos" icon={Package} label="Catálogo" sub="precios y stock" />
        <QuickLink to="/vendedor/perfil" icon={TrendingUp} label="Mi perfil" sub="cuenta y datos" />
      </div>

      {rows.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground px-1">Últimos pedidos</h2>
          {rows.slice(0, 3).map((o) => (
            <Link key={o.id} to="/pedidos/$id" params={{ id: o.id }}>
              <Card className="p-3 hover:bg-accent/30 transition">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate text-sm">{o.customer?.display_name ?? "Cliente"}</div>
                    <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("es-CO")}</div>
                  </div>
                  <div className="text-sm font-semibold">{formatCurrency(Number(o.total))}</div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function OperativoHome() {
  const { hasRole } = useAuth();
  const fetchInbox = useServerFn(myFlowInbox);
  const [pending, setPending] = useState<number>(0);
  const [active, setActive] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const roleLabel = hasRole("conductor") ? "Conductor" : "Bodega";

  useEffect(() => {
    fetchInbox({})
      .then((r) => { setPending((r.pending as unknown[]).length); setActive((r.active as unknown[]).length); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchInbox]);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Hola 👋</h1>
        <p className="text-sm text-muted-foreground">Panel {roleLabel}</p>
      </div>

      {loading ? (
        <div className="grid place-items-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Por aceptar" value={String(pending)} sub="transferencias" />
          <StatCard label="En curso" value={String(active)} sub="en mi área" />
        </div>
      )}

      <Link to="/vendedor/bandeja">
        <Card className="p-5 flex items-center gap-3 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0 shadow-md">
          <div className="w-12 h-12 rounded-full bg-white/20 grid place-items-center">
            <Inbox className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Abrir mi bandeja</div>
            <div className="text-xs opacity-90">Pedidos pendientes y en proceso</div>
          </div>
        </Card>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <QuickLink to="/vendedor/productos" icon={Package} label="Stock" sub="catálogo" />
        <QuickLink to="/vendedor/perfil" icon={ShoppingBag} label="Perfil" sub="mi cuenta" />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
      <div className="text-lg font-bold mt-0.5 truncate">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </Card>
  );
}

function QuickLink({ to, icon: Icon, label, sub }: { to: string; icon: typeof Plus; label: string; sub: string }) {
  return (
    <Link to={to}>
      <Card className="p-3 hover:bg-accent/30 transition-colors h-full">
        <Icon className="w-5 h-5 text-primary mb-1" />
        <div className="font-medium text-sm">{label}</div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </Card>
    </Link>
  );
}
