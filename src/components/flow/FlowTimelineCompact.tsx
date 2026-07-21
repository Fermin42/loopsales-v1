import { EVENT_LABELS, STATUS_LABELS, formatDateTime, type OrderEventType } from "@/lib/order-flow";

interface Evt {
  id: string; event_type: string; to_status: string; event_at: string;
}

// Timeline resumida para vendedores: solo cuándo pasó y a qué estado, sin nombres ni roles.
export function FlowTimelineCompact({ events }: { events: Evt[] }) {
  if (events.length === 0) return <div className="text-sm text-muted-foreground">Sin eventos aún.</div>;
  return (
    <ol className="relative border-l-2 border-primary/30 ml-2 space-y-3">
      {events.map((e) => (
        <li key={e.id} className="pl-4 relative">
          <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-primary" />
          <div className="text-sm font-medium">
            {EVENT_LABELS[e.event_type as OrderEventType] ?? STATUS_LABELS[e.to_status] ?? e.to_status}
          </div>
          <div className="text-xs text-muted-foreground">{formatDateTime(e.event_at)}</div>
        </li>
      ))}
    </ol>
  );
}
