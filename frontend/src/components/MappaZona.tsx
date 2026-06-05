import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons (webpack/vite asset issue)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MappaZonaProps {
  /** Coordinate centro (domicilio operatore o paziente) */
  center?: { lat: number; lng: number };
  /** Raggio in km da disegnare */
  raggioKm?: number;
  /** Callback quando l'utente clicca sulla mappa (per scegliere posizione) */
  onClickMappa?: (lat: number, lng: number) => void;
  /** Marker aggiuntivi (es. operatori in zona) */
  markers?: {
    lat: number; lng: number;
    label: string; sublabel?: string;
    colore?: string; distanzaKm?: number;
  }[];
  /** Marker paziente fisso */
  markerPaziente?: { lat: number; lng: number; label: string };
  altezza?: number;
  readonly?: boolean;
}

export default function MappaZona({
  center,
  raggioKm = 10,
  onClickMappa,
  markers = [],
  markerPaziente,
  altezza = 380,
  readonly = false,
}: MappaZonaProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const cerchioRef = useRef<L.Circle | null>(null);
  const markerCentroRef = useRef<L.Marker | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const defaultCenter: [number, number] = center
    ? [center.lat, center.lng]
    : [41.9028, 12.4964]; // Roma

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: defaultCenter,
      zoom: center ? 11 : 6,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);

    if (!readonly && onClickMappa) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onClickMappa(e.latlng.lat, e.latlng.lng);
      });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Aggiorna cerchio + marker centro al cambio di center/raggio
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (cerchioRef.current) { cerchioRef.current.remove(); cerchioRef.current = null; }
    if (markerCentroRef.current) { markerCentroRef.current.remove(); markerCentroRef.current = null; }

    if (center) {
      map.setView([center.lat, center.lng], 11);
      cerchioRef.current = L.circle([center.lat, center.lng], {
        radius: raggioKm * 1000,
        color: '#1e4d8c',
        fillColor: '#1e4d8c',
        fillOpacity: 0.12,
        weight: 2,
      }).addTo(map);

      const icon = L.divIcon({
        html: `<div style="background:#1e4d8c;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">🏠</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        className: '',
      });
      markerCentroRef.current = L.marker([center.lat, center.lng], { icon })
        .addTo(map)
        .bindPopup('Domicilio partenza');
    }
  }, [center?.lat, center?.lng, raggioKm]);

  // Aggiorna markers operatori
  useEffect(() => {
    const layer = markersLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    if (markerPaziente) {
      const icon = L.divIcon({
        html: `<div style="background:#dc2626;color:white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:15px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">🏥</div>`,
        iconSize: [30, 30], iconAnchor: [15, 15], className: '',
      });
      L.marker([markerPaziente.lat, markerPaziente.lng], { icon })
        .addTo(layer)
        .bindPopup(`<strong>${markerPaziente.label}</strong>`);
    }

    markers.forEach((m, i) => {
      const colore = m.colore || '#059669';
      const icon = L.divIcon({
        html: `<div style="background:${colore};color:white;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${i + 1}</div>`,
        iconSize: [26, 26], iconAnchor: [13, 13], className: '',
      });
      L.marker([m.lat, m.lng], { icon })
        .addTo(layer)
        .bindPopup(`<strong>${m.label}</strong>${m.sublabel ? '<br/>' + m.sublabel : ''}${m.distanzaKm !== undefined ? '<br/>📍 ' + m.distanzaKm + ' km' : ''}`);
    });

    // Fit bounds se ci sono marker + paziente
    const allPoints: [number, number][] = [];
    if (markerPaziente) allPoints.push([markerPaziente.lat, markerPaziente.lng]);
    markers.forEach(m => allPoints.push([m.lat, m.lng]));
    if (center) allPoints.push([center.lat, center.lng]);
    if (allPoints.length > 1 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(allPoints, { padding: [40, 40] });
    }
  }, [markers, markerPaziente]);

  return (
    <div
      ref={mapRef}
      style={{ width: '100%', height: altezza, borderRadius: '10px', border: '1px solid #e2e8f0', zIndex: 0 }}
    />
  );
}
