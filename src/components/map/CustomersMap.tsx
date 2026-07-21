import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  color: string;
  title: string;
  subtitle?: string;
  extra?: string;
};

interface Props {
  pins: MapPin[];
  onPinClick?: (id: string) => void;
  height?: number;
}

// Mapa de clientes con Leaflet + OpenStreetMap (tiles gratis).
export default function CustomersMap({ pins, onPinClick, height = 520 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [4.65, -74.1], zoom: 6, scrollWheelZoom: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setReady(true);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const bounds = useMemo(() => {
    if (pins.length === 0) return null;
    return L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
  }, [pins]);

  useEffect(() => {
    if (!ready || !layerRef.current || !mapRef.current) return;
    layerRef.current.clearLayers();
    for (const p of pins) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:22px;height:22px;border-radius:50%;background:${p.color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const m = L.marker([p.lat, p.lng], { icon }).addTo(layerRef.current);
      const html = `<div style="min-width:180px">
        <div style="font-weight:600">${escape(p.title)}</div>
        ${p.subtitle ? `<div style="font-size:12px;color:#555">${escape(p.subtitle)}</div>` : ""}
        ${p.extra ? `<div style="font-size:11px;margin-top:4px">${escape(p.extra)}</div>` : ""}
      </div>`;
      m.bindPopup(html);
      if (onPinClick) m.on("click", () => onPinClick(p.id));
    }
    if (bounds) mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [pins, ready, bounds, onPinClick]);

  return <div ref={containerRef} style={{ height, width: "100%", borderRadius: 12, overflow: "hidden" }} />;
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
