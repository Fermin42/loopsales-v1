import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, GitBranch } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getFlowSettings, listTimeline } from "@/lib/orders/flow.functions";
import { getAvailableActions, type AppRole, type NextAction } from "@/lib/order-flow";
import { ActionDialog } from "./ActionDialog";
import { AcceptRejectPanel } from "./AcceptRejectPanel";
import { FlowTimeline } from "./FlowTimeline";
import { FlowTimelineCompact } from "./FlowTimelineCompact";
import { StatusBadge } from "./StatusBadge";


interface Props {
  orderId: string;
  status: string;
  pendingHolderUser: string | null;
  sellerId: string;
  confirmedAt: string | null;
  onChange: () => void;
}

export function OrderFlowSection({ orderId, status, pendingHolderUser, sellerId: _sellerId, confirmedAt: _confirmedAt, onChange }: Props) {
  const { user, roles } = useAuth();
  const fetchTimeline = useServerFn(listTimeline);
  const fetchSettings = useServerFn(getFlowSettings);

  const [tl, setTl] = useState<{ events: Parameters<typeof FlowTimeline>[0]["events"]; evidences: Parameters<typeof FlowTimeline>[0]["evidences"]; profiles: Parameters<typeof FlowTimeline>[0]["profiles"] }>({ events: [], evidences: [], profiles: {} });
  const [mode, setMode] = useState<"signature" | "acceptance">("acceptance");
  const [loading, setLoading] = useState(true);
  const [openAction, setOpenAction] = useState<NextAction | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchTimeline({ data: { order_id: orderId } }),
      fetchSettings({}),
    ]).then(([t, s]) => {
      setTl({
        events: t.events as typeof tl.events,
        evidences: t.evidences as typeof tl.evidences,
        profiles: t.profiles as typeof tl.profiles,
      });
      setMode(s.confirmation_mode);
    }).catch(() => {}).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  // Rehidratar el modal de acción tras recargas del WebView (cámara nativa).
  const flowKey = `flow-action:${orderId}`;
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(flowKey);
      if (raw) setOpenAction(JSON.parse(raw) as NextAction);
    } catch { /* noop */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (openAction) sessionStorage.setItem(flowKey, JSON.stringify(openAction));
    else sessionStorage.removeItem(flowKey);
  }, [openAction, flowKey]);

  const myRoles = (roles ?? []) as AppRole[];
  const isPendingForMe = status === "pending_acceptance" && pendingHolderUser === user?.id;
  const actions = getAvailableActions(status, myRoles);
  // La confirmación del pedido y el envío al flujo solo se hacen vía facturación
  // (al facturar) o desde acciones del flujo. No exponemos un botón "Confirmar" aquí.

  const reload = () => { load(); onChange(); };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GitBranch className="w-4 h-4" />
        <div className="font-medium">Trazabilidad</div>
        <div className="ml-auto"><StatusBadge status={status} /></div>
      </div>


      {isPendingForMe && <AcceptRejectPanel orderId={orderId} onDone={reload} />}

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a.key} size="sm" variant="outline" onClick={() => setOpenAction(a)}>{a.shortLabel}</Button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        // Vendedores puros ven la línea resumida (sin nombres/roles); los demás ven la completa.
        myRoles.length === 1 && myRoles[0] === "vendedor" ? (
          <FlowTimelineCompact events={tl.events} />
        ) : (
          <FlowTimeline
            events={tl.events}
            evidences={tl.evidences}
            profiles={tl.profiles}
            viewerRoles={myRoles}
            viewerId={user?.id ?? null}
          />
        )
      )}

      <ActionDialog
        orderId={orderId}
        action={openAction}
        confirmationMode={mode}
        onClose={() => setOpenAction(null)}
        onDone={reload}
      />
    </Card>
  );
}