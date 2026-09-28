"use client";

// LIVING CITY — live city map (Leaflet + OSM tiles, dark-filtered for command-center look).
// Markers come from REAL stored events only. No fake coordinates are ever drawn.

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { SEVERITY_COLORS, EVENT_ICONS, ORIGIN_META } from "@/lib/city-format";
import type { PublicEvent } from "@/lib/city-api";

interface CityMapProps {
  events: PublicEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CityMap({ events, selectedId, onSelect }: CityMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const circleRef = useRef<L.Circle | null>(null);

  const located = useMemo(() => events.filter((e) => e.latitude !== null && e.longitude !== null), [events]);

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [17.385, 78.4867],
      zoom: 11,
      zoomControl: false,
      attributionControl: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: "city-map-tiles",
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // sync markers with events
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();

    for (const e of located) {
      seen.add(e.id);
      const color = SEVERITY_COLORS[e.severity] ?? "#64748b";
      const icon = L.divIcon({
        className: "city-marker-wrap",
        html: `<div class="city-marker ${e.id === selectedId ? "city-marker-selected" : ""}" style="--marker-color:${color}">
                 <span class="city-marker-pulse"></span>
                 <span class="city-marker-emoji">${EVENT_ICONS[e.eventType] ?? "📍"}</span>
               </div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const existing = markersRef.current.get(e.id);
      if (existing) {
        existing.setIcon(icon);
      } else {
        const marker = L.marker([e.latitude!, e.longitude!], { icon }).addTo(map);
        marker.on("click", () => onSelect(e.id));
        markersRef.current.set(e.id, marker);
      }
    }

    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    // selection ring
    const selected = located.find((e) => e.id === selectedId);
    if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }
    if (selected) {
      circleRef.current = L.circle([selected.latitude!, selected.longitude!], {
        radius: 900,
        color: ORIGIN_META[selected.dataOrigin]?.color ?? "#38bdf8",
        weight: 1.5,
        fillColor: ORIGIN_META[selected.dataOrigin]?.color ?? "#38bdf8",
        fillOpacity: 0.08,
        dashArray: "4 4",
      }).addTo(map);
    }
  }, [located, selectedId, onSelect]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div ref={containerRef} className="h-full w-full" />
      {located.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/70">
          <p className="text-xs uppercase tracking-widest text-slate-500">Awaiting located events…</p>
        </div>
      )}
    </div>
  );
}
