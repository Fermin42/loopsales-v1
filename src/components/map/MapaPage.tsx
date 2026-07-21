import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Plus, Trash2, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  listMapCustomers, listRoutes, saveRoute, deleteRoute,
  assignCustomerRoute, listSellersForMap,
} from "@/lib/customers/routes.functions";

const CustomersMap = lazy(() => import("@/components/map/CustomersMap"));

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type MapRoute = { id: string; seller_id: string; name: string; color: string; day_of_week: number | null; seller_name?: string | null };
type MapCust = { id: string; display_name: string; identification: string; address: string | null; city_name: string | null; phone: string | null; geo_lat: number; geo_lng: number; route_id: string | null; assigned_seller_user: string | null; assigned_seller_name?: string | null };

export function MapaPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const canEdit = hasRole(["admin", "vendedor"]);

  const fetchMap = useServerFn(listMapCustomers);
  const fetchRoutes = useServerFn(listRoutes);
  const fetchSellers = useServerFn(listSellersForMap);
  const saveRouteFn = useServerFn(saveRoute);
  const delRouteFn = useServerFn(deleteRoute);
  const assignFn = useServerFn(assignCustomerRoute);

  const [customers, setCustomers] = useState<MapCust[]>([]);
  const [routes, setRoutes] = useState<MapRoute[]>([]);
  const [sellers, setSellers] = useState<Array<{ id: string; name: string }>>([]);
  const [sellerFilter, setSellerFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [routeOpen, setRouteOpen] = useState(false);
  const [editRoute, setEditRoute] = useState<Partial<MapRoute>>({ name: "", color: "#3B82F6", day_of_week: null });
  const [assignOpen, setAssignOpen] = useState<MapCust | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetchMap({ data: { seller_filter: sellerFilter !== "all" && isAdmin ? sellerFilter : null } }),
      fetchRoutes({}),
    ]).then(([m, r]) => {
      setCustomers(m.customers as MapCust[]);
      setRoutes(r.routes as MapRoute[]);
    }).catch((e) => toast.error(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [sellerFilter]);
  useEffect(() => {
    if (!isAdmin) return;
    fetchSellers({}).then((r) => setSellers(r.sellers)).catch(() => {});
  }, [isAdmin, fetchSellers]);

  const routeById = useMemo(() => new Map(routes.map((r) => [r.id, r])), [routes]);

  const pins = useMemo(() => customers.map((c) => {
    const r = c.route_id ? routeById.get(c.route_id) : null;
    return {
      id: c.id,
      lat: c.geo_lat,
      lng: c.geo_lng,
      color: r?.color ?? "#94a3b8",
      title: c.display_name,
      subtitle: [c.address, c.city_name].filter(Boolean).join(" · ") || c.identification,
      extra: [
        r ? `Ruta: ${r.name}${r.day_of_week != null ? ` (${DAYS[r.day_of_week]})` : ""}` : "Sin ruta",
        c.assigned_seller_name ? `Vendedor: ${c.assigned_seller_name}` : "",
      ].filter(Boolean).join(" · "),
    };
  }), [customers, routeById]);

  const onPinClick = (id: string) => {
    if (!canEdit) return;
    const c = customers.find((x) => x.id === id);
    if (c) setAssignOpen(c);
  };

  const onSaveRoute = async () => {
    if (!editRoute.name || editRoute.name.trim().length === 0) return toast.error("Nombre requerido");
    try {
      await saveRouteFn({ data: {
        id: editRoute.id,
        name: editRoute.name.trim(),
        color: editRoute.color || "#3B82F6",
        day_of_week: editRoute.day_of_week ?? null,
      } });
      toast.success("Ruta guardada");
      setRouteOpen(false);
      setEditRoute({ name: "", color: "#3B82F6", day_of_week: null });
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  const onDeleteRoute = async (id: string) => {
    if (!confirm("¿Eliminar esta ruta?")) return;
    try { await delRouteFn({ data: { id } }); toast.success("Eliminada"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  const onAssign = async (routeId: string | null) => {
    if (!assignOpen) return;
    try {
      await assignFn({ data: { customer_id: assignOpen.id, route_id: routeId } });
      toast.success("Cliente asignado");
      setAssignOpen(null);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <MapPin className="w-5 h-5" />
        <h1 className="text-xl md:text-2xl font-bold">Mapa de clientes</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Select value={sellerFilter} onValueChange={setSellerFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los vendedores</SelectItem>
                {sellers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {canEdit && (
            <Button size="sm" onClick={() => { setEditRoute({ name: "", color: "#3B82F6", day_of_week: null }); setRouteOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />Nueva ruta
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
        <Card className="p-2 overflow-hidden">
          {loading ? (
            <div className="grid place-items-center h-[520px]"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : customers.length === 0 ? (
            <div className="grid place-items-center h-[520px] text-sm text-muted-foreground">
              No hay clientes con ubicación fijada aún.
            </div>
          ) : (
            <ClientOnly fallback={<div className="grid place-items-center h-[520px]"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
              <Suspense fallback={<div className="grid place-items-center h-[520px]"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
                <CustomersMap pins={pins} onPinClick={onPinClick} />
              </Suspense>
            </ClientOnly>
          )}
        </Card>

        <Card className="p-3 space-y-2">
          <div className="font-medium flex items-center gap-2"><RouteIcon className="w-4 h-4" />Rutas</div>
          {routes.length === 0 && <div className="text-xs text-muted-foreground">Aún no hay rutas.</div>}
          <ul className="space-y-1 max-h-[480px] overflow-y-auto">
            {routes.map((r) => (
              <li key={r.id} className="flex items-center gap-2 border rounded px-2 py-1.5">
                <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: r.color }} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {r.day_of_week != null ? DAYS[r.day_of_week] : "Sin día"}
                    {isAdmin && r.seller_name ? ` · ${r.seller_name}` : ""}
                  </div>
                </div>
                {canEdit && (
                  <>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditRoute(r); setRouteOpen(true); }}>
                      <Plus className="w-3.5 h-3.5 rotate-45" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDeleteRoute(r.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="pt-2 border-t text-[11px] text-muted-foreground">
            <div className="mb-1">Total clientes en mapa: {customers.length}</div>
            {canEdit && <div>Haz clic en un pin para asignarlo a una ruta.</div>}
          </div>
        </Card>
      </div>

      {/* Modal ruta */}
      <Dialog open={routeOpen} onOpenChange={setRouteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editRoute.id ? "Editar ruta" : "Nueva ruta"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input value={editRoute.name ?? ""} onChange={(e) => setEditRoute({ ...editRoute, name: e.target.value })} placeholder="Ej. Ruta Norte" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Color</Label>
                <Input type="color" value={editRoute.color ?? "#3B82F6"} onChange={(e) => setEditRoute({ ...editRoute, color: e.target.value })} className="h-10 p-1" />
              </div>
              <div>
                <Label>Día (opcional)</Label>
                <Select value={editRoute.day_of_week != null ? String(editRoute.day_of_week) : "none"} onValueChange={(v) => setEditRoute({ ...editRoute, day_of_week: v === "none" ? null : Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sin día —</SelectItem>
                    {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRouteOpen(false)}>Cancelar</Button>
            <Button onClick={onSaveRoute}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal asignar cliente */}
      <Dialog open={!!assignOpen} onOpenChange={(o) => !o && setAssignOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{assignOpen?.display_name}</DialogTitle></DialogHeader>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div>{assignOpen?.address} {assignOpen?.city_name ? `· ${assignOpen.city_name}` : ""}</div>
            <div>{assignOpen?.identification}{assignOpen?.phone ? ` · ${assignOpen.phone}` : ""}</div>
            {assignOpen?.assigned_seller_name && <Badge variant="outline">Vendedor: {assignOpen.assigned_seller_name}</Badge>}
          </div>
          <div className="space-y-2 mt-3">
            <Label className="text-xs">Asignar a ruta</Label>
            <div className="grid grid-cols-1 gap-1 max-h-72 overflow-y-auto">
              <Button variant={assignOpen?.route_id == null ? "default" : "outline"} size="sm" onClick={() => onAssign(null)} className="justify-start">
                <span className="w-3 h-3 rounded-full bg-slate-400 mr-2" />Sin ruta
              </Button>
              {routes.map((r) => (
                <Button key={r.id} variant={assignOpen?.route_id === r.id ? "default" : "outline"} size="sm" onClick={() => onAssign(r.id)} className="justify-start">
                  <span className="w-3 h-3 rounded-full mr-2" style={{ background: r.color }} />
                  {r.name}{r.day_of_week != null ? ` · ${DAYS[r.day_of_week]}` : ""}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
