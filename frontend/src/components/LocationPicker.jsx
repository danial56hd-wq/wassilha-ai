import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { useTheme } from "next-themes";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LocateFixed, Loader2 } from "lucide-react";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Reusable GPS + draggable marker location picker. value = {lat, lng}
export default function LocationPicker({ value, onChange, height = 240 }) {
  const { t } = useApp();
  const { resolvedTheme } = useTheme();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const layerRef = useRef(null);
  const [locating, setLocating] = useState(false);
  const start = value?.lat != null ? [value.lat, value.lng] : [24.7136, 46.6753];

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView(start, value?.lat != null ? 14 : 5);
    mapRef.current = map;
    const marker = L.marker(start, { draggable: true }).addTo(map);
    markerRef.current = marker;
    marker.on("dragend", () => {
      const { lat, lng } = marker.getLatLng();
      onChange({ lat: +lat.toFixed(6), lng: +lng.toFixed(6) });
    });
    map.on("click", (e) => {
      marker.setLatLng(e.latlng);
      onChange({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) });
    });
    setTimeout(() => map.invalidateSize(), 200);
    return () => { map.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layerRef.current) map.removeLayer(layerRef.current);
    const url = resolvedTheme === "dark"
      ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    layerRef.current = L.tileLayer(url, { attribution: "&copy; OpenStreetMap contributors", maxZoom: 19 }).addTo(map);
  }, [resolvedTheme]);

  useEffect(() => {
    if (value?.lat != null && markerRef.current && mapRef.current) {
      const cur = markerRef.current.getLatLng();
      if (Math.abs(cur.lat - value.lat) > 1e-6 || Math.abs(cur.lng - value.lng) > 1e-6) {
        markerRef.current.setLatLng([value.lat, value.lng]);
        mapRef.current.setView([value.lat, value.lng], Math.max(mapRef.current.getZoom(), 14));
      }
    }
  }, [value?.lat, value?.lng]);

  const locate = () => {
    if (!navigator.geolocation) return toast.error(t("location_denied"));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = +pos.coords.latitude.toFixed(6), lng = +pos.coords.longitude.toFixed(6);
        onChange({ lat, lng });
        if (mapRef.current) mapRef.current.setView([lat, lng], 15);
        if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
        setLocating(false);
      },
      () => { toast.error(t("location_denied")); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{t("location")}</Label>
        <Button type="button" variant="outline" size="sm" onClick={locate} disabled={locating} data-testid="locate-me-button">
          {locating ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <LocateFixed className="h-4 w-4 me-1" />}{t("my_location")}
        </Button>
      </div>
      <div ref={containerRef} data-testid="location-picker-map" className="rounded-xl overflow-hidden border border-border" style={{ height }} />
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" placeholder="Lat" value={value?.lat ?? ""} data-testid="location-lat"
          onChange={(e) => onChange({ lat: e.target.value === "" ? null : parseFloat(e.target.value), lng: value?.lng ?? null })} />
        <Input type="number" placeholder="Lng" value={value?.lng ?? ""} data-testid="location-lng"
          onChange={(e) => onChange({ lat: value?.lat ?? null, lng: e.target.value === "" ? null : parseFloat(e.target.value) })} />
      </div>
    </div>
  );
}
