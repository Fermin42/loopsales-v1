import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Check, Inbox, Pencil } from "lucide-react";
import { toast } from "sonner";
import { listPendingCustomers, approveCustomer } from "@/lib/catalog/catalog.functions";
import { CityAutocomplete, type SelectedCity } from "@/components/CityAutocomplete";

export const Route = createFileRoute("/_authenticated/admin/clientes-pendientes")({
  component: PendingCustomersPage,
});

// Etiquetas legibles para los códigos de tipo de identificación Siigo (Colombia).
const ID_TYPE_LABELS: Record<string, string> = {
  "11": "Registro civil",
  "12": "Tarjeta de identidad",
  "13": "Cédula de ciudadanía",
  "21": "Tarjeta de extranjería",
  "22": "Cédula de extranjería",
  "31": "NIT",
  "32": "NIT extranjero",
  "41": "Pasaporte",
  "42": "Documento de identificación extranjero",
  "43": "Sin identificación del exterior",
  "50": "NIT otro país",
  "91": "NUIP",
};

const ID_TYPE_OPTIONS = Object.entries(ID_TYPE_LABELS);

type Pending = {
  id: string;
  identification: string;
  id_type: string | null;
  person_type: string | null;
  display_name: string;
  commercial_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city_name: string | null;
  city_code: string | null;
  country_code: string | null;
  seller_siigo_id: string | null;
  created_at: string;
  requester_name: string | null;
  requester_email: string | null;
};

function PendingCustomersPage() {
  const fetchList = useServerFn(listPendingCustomers);
  const approveFn = useServerFn(approveCustomer);
  const [rows, setRows] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Pending | null>(null);
  const [editingCity, setEditingCity] = useState<SelectedCity | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    fetchList({})
      .then((r) => setRows(r.customers as unknown as Pending[]))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const onApprove = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await toast.promise(
        approveFn({ data: { id: editing.id, patch: {
          identification: editing.identification,
          id_type: editing.id_type ?? "13",
          person_type: (editing.person_type ?? "Person") as "Person" | "Company",
          display_name: editing.display_name,
          commercial_name: editing.commercial_name ?? undefined,
          first_name: editing.first_name ?? undefined,
          last_name: editing.last_name ?? undefined,
          email: editing.email ?? undefined,
          phone: editing.phone ?? undefined,
          address: editing.address ?? undefined,
          city_name: editing.city_name ?? undefined,
          city_code: editing.city_code ?? undefined,
          country_code: editing.country_code ?? "Co",
        } } }),
        {
          loading: "Aprobando y creando en Siigo…",
          success: "Cliente aprobado y creado en Siigo",
          error: (e) => (e instanceof Error ? e.message : "Error al aprobar"),
        },
      );
      setEditing(null);
      load();
    } catch { /* toast ya lo mostró */ } finally { setBusy(false); }
  };

  if (loading) return <div className="grid place-items-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-6 md:p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Clientes por aprobar</h1>
        <p className="text-sm text-muted-foreground">Verifica los datos y autoriza la creación en Siigo. Mientras estén pendientes, no se podrán facturar pedidos de estos clientes.</p>
      </div>

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No hay clientes pendientes.
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{c.display_name}</span>
                    <Badge variant="secondary">{c.person_type === "Company" ? "Jurídica" : "Natural"}</Badge>
                    <Badge variant="outline">{(c.id_type && ID_TYPE_LABELS[c.id_type]) || c.id_type || "—"} · {c.identification}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {c.email ?? "sin email"} · {c.phone ?? "sin tel"} · {c.city_name ?? "sin ciudad"}
                  </div>
                  <div className="text-xs text-muted-foreground">{c.address ?? "sin dirección"}</div>
                  <div className="text-[11px] mt-1 flex flex-wrap gap-x-3">
                    <span className="text-muted-foreground">Solicitado: {new Date(c.created_at).toLocaleString("es-CO")}</span>
                    <span><span className="text-muted-foreground">Vendedor:</span> <span className="font-medium">{c.requester_name || c.requester_email || "—"}</span></span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => setEditing(c)}>
                    <Pencil className="w-4 h-4 mr-1" /> Revisar
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal aprobar / editar */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Revisar y aprobar cliente</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-2">
              <div className="text-xs bg-muted/50 rounded px-2 py-1">
                <span className="text-muted-foreground">Solicitado por:</span>{" "}
                <span className="font-medium">{editing.requester_name || editing.requester_email || "—"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Tipo persona</Label>
                  <select
                    className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                    value={editing.person_type ?? "Person"}
                    onChange={(e) => setEditing({ ...editing, person_type: e.target.value })}
                  >
                    <option value="Person">Natural</option>
                    <option value="Company">Jurídica</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Tipo documento</Label>
                  <Select value={editing.id_type ?? "13"} onValueChange={(v) => setEditing({ ...editing, id_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ID_TYPE_OPTIONS.map(([code, label]) => (
                        <SelectItem key={code} value={code}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Identificación</Label>
                <Input value={editing.identification} onChange={(e) => setEditing({ ...editing, identification: e.target.value })} />
              </div>
              {editing.person_type === "Person" ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Nombres</Label>
                    <Input value={editing.first_name ?? ""} onChange={(e) => setEditing({ ...editing, first_name: e.target.value, display_name: `${e.target.value} ${editing.last_name ?? ""}`.trim() })} />
                  </div>
                  <div>
                    <Label className="text-xs">Apellidos</Label>
                    <Input value={editing.last_name ?? ""} onChange={(e) => setEditing({ ...editing, last_name: e.target.value, display_name: `${editing.first_name ?? ""} ${e.target.value}`.trim() })} />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-xs">Razón social</Label>
                    <Input value={editing.display_name} onChange={(e) => setEditing({ ...editing, display_name: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Nombre comercial</Label>
                    <Input value={editing.commercial_name ?? ""} onChange={(e) => setEditing({ ...editing, commercial_name: e.target.value })} />
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Teléfono</Label>
                  <Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Dirección</Label>
                <Input value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Ciudad (catálogo Siigo)</Label>
                <CityAutocomplete
                  value={editingCity}
                  inputValue={editing.city_name ?? ""}
                  onChange={(city, rawText) => {
                    setEditingCity(city);
                    setEditing({
                      ...editing,
                      city_name: city?.name ?? rawText,
                      city_code: city?.code ?? editing.city_code,
                      country_code: city?.country_code ?? editing.country_code,
                    });
                  }}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {editingCity || editing.city_code
                    ? `Ciudad: ${editing.city_name ?? "—"} · cód. ${editingCity?.code ?? editing.city_code ?? "—"}`
                    : "Si no eliges una ciudad del listado se usará Bogotá (11001)."}
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>Cancelar</Button>
            <Button onClick={onApprove} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Aprobar y crear en Siigo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
