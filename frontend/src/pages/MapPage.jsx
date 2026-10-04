import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import { useTheme } from "next-themes";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common";
import { MapPin, LocateFixed, Maximize } from "lucide-react";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const deliveryIcon = L.divIcon({
  className: "", html: '<div style="background:#F59E0B;width:16px;height:16px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [16, 16], iconAnchor: [8, 16],
});
const bizIcon = L.divIcon({
  className: "", html: '<div style="background:#0D9488;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 1px 6px rgba(0,0,0,.5)"></div>',
  iconSize: [18, 18], iconAnchor: [9, 9],
});

export default function MapPage() {
  const { t, settings } = useApp();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const groupRef = useRef(null);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.get("/customers").then((r) => setCustomers(r.data)).catch(() => {});
    api.get("/orders").then((r) => setOrders(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center = settings?.business_lat != null ? [settings.business_lat, settings.business_lng] : [24.7136, 46.6753];
    const map = L.map(containerRef.current, { zoomControl: true }).setView(center, settings?.business_lat != null ? 12 : 5);
    mapRef.current = map;
    setReady(true);
  }, [settings]); // eslint-disable-line

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layerRef.current) map.removeLayer(layerRef.current);
    const url = resolvedTheme === "dark"
      ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    layerRef.current = L.tileLayer(url, { attribution: "&copy; OpenStreetMap contributors", maxZoom: 19 }).addTo(map);
  }, [resolvedTheme, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (groupRef.current) map.removeLayer(groupRef.current);
    const markers = [];
    if (settings?.business_lat != null) {
      markers.push(L.marker([settings.business_lat, settings.business_lng], { icon: bizIcon }).bindPopup(`<b>${settings.business_name || t("business_location")}</b>`));
    }
    customers.filter((c) => c.lat != null && c.lng != null).forEach((c) => {
      const m = L.marker([c.lat, c.lng]);
      m.bindPopup(`<b>${c.name}</b>${c.phone ? "<br/>" + c.phone : ""}`);
      markers.push(m);
    });
    orders.filter((o) => o.delivery_lat != null && o.delivery_lng != null).forEach((o) => {
      markers.push(L.marker([o.delivery_lat, o.delivery_lng], { icon: deliveryIcon }).bindPopup(`<b>${t("delivery")}: ${o.number}</b><br/>${o.customer_name || ""}`));
    });
    if (markers.length) {
      const g = L.featureGroup(markers).addTo(map);
      groupRef.current = g;
      try { map.fitBounds(g.getBounds().pad(0.3)); } catch {}
    }
  }, [customers, orders, ready, settings]); // eslint-disable-line

  const locate = () => {
    if (!navigator.geolocation) return toast.error(t("location_denied"));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.setView([latitude, longitude], 15);
        L.circleMarker([latitude, longitude], { radius: 8, color: "#3B82F6", fillColor: "#3B82F6", fillOpacity: 0.6 }).addTo(mapRef.current).bindPopup(t("my_location")).openPopup();
      },
      () => toast.error(t("location_denied")),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const withCoords = customers.filter((c) => c.lat != null && c.lng != null).length;
  const deliveries = orders.filter((o) => o.delivery_lat != null).length;

  return (
    <div>
      <PageHeader title={t("map")} icon={MapPin} subtitle={`${withCoords} ${t("customers")} · ${deliveries} ${t("delivery")}`}
        action={<Button onClick={locate} data-testid="locate-me-map"><LocateFixed className="h-4 w-4 me-1" />{t("my_location")}</Button>} />
      <Card className="overflow-hidden p-0 relative">
        <div ref={containerRef} data-testid="map-container" style={{ height: "72vh", width: "100%" }} />
      </Card>
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-primary" />{t("business_location")}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: "#3B82F6" }} />{t("customers")}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-accent" />{t("delivery")}</span>
      </div>
    </div>
  );
}
