import { createFileRoute } from "@tanstack/react-router";
import { MapaPage } from "@/components/map/MapaPage";

export const Route = createFileRoute("/_authenticated/admin/mapa")({
  component: MapaPage,
});
