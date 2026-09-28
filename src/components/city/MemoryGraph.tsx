"use client";

// City Memory Graph — relationship structure built ONLY from stored events
// and stored relationships (event_relationships table). Nothing hardcoded.

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/city-api";
import { EVENT_ICONS, RELATION_COLORS } from "@/lib/city-format";

interface GraphNode {
  id: string;
  title: string;
  eventType: string;
  observedAt: string;
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
  relation: string;
  confidence: number;
}

export function MemoryGraph({ onSelectEvent }: { onSelectEvent: (id: string) => void }) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const patterns = await api.patterns();
        if (!alive) return;
        const nodeMap = new Map<string, { title: string; eventType: string; observedAt: string }>();
        const edgeList: GraphEdge[] = [];
        for (const p of patterns.patterns) {
          nodeMap.set(p.from.id, p.from);
          nodeMap.set(p.to.id, p.to);
          edgeList.push({ from: p.from.id, to: p.to.id, relation: p.relation, confidence: p.confidence });
        }
        const W = 640;
        const H = 380;
        const list = [...nodeMap.entries()].slice(0, 24);
        const laid = list.map(([id, v], i) => {
          const ring = Math.floor(i / 8) + 1;
          const angle = (i % 8) * (Math.PI / 4) + ring * 0.4;
          const r = ring * 95;
          return {
            id,
            title: v.title,
            eventType: v.eventType,
            observedAt: v.observedAt,
            x: W / 2 + Math.cos(angle) * r,
            y: H / 2 + Math.sin(angle) * r * 0.72,
          };
        });
        setNodes(laid);
        setEdges(edgeList.filter((e) => laid.some((n) => n.id === e.from) && laid.some((n) => n.id === e.to)));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const width = 640;
  const height = 380;

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-[#1c2942] bg-[#0a101c]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-[#1c2942] bg-[#0a101c]">
      <div className="flex items-center justify-between border-b border-[#1c2942] px-4 py-2.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-slate-300">City Memory Graph</h2>
        <span className="text-[10px] text-slate-500">
          {nodes.length} nodes · {edges.length} edges — from stored relationships
        </span>
      </div>
      {nodes.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center">
          <span className="text-2xl opacity-40">🕸️</span>
          <p className="text-xs text-slate-500">
            No recurring patterns mapped yet. Relationships appear as the city accumulates events — run the memory demo to create some.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto px-2 py-3">
          <svg width={width} height={height} role="img" aria-label="City memory relationship graph" className="mx-auto block">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b4a6b" />
              </marker>
            </defs>
            {edges.map((e, i) => {
              const a = byId.get(e.from);
              const b = byId.get(e.to);
              if (!a || !b) return null;
              const color = RELATION_COLORS[e.relation] ?? "#3b4a6b";
              return (
                <g key={i}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={color}
                    strokeWidth={e.relation === "POSSIBLE_ESCALATION" ? 1.8 : 1.1}
                    strokeOpacity={0.4 + e.confidence * 0.4}
                    className="lc-graph-edge"
                    markerEnd="url(#arrow)"
                  />
                </g>
              );
            })}
            {nodes.map((n) => (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                className="cursor-pointer"
                onClick={() => onSelectEvent(n.id)}
              >
                <circle r={17} fill="#0d1526" stroke="#2b3b5e" strokeWidth={1.2} />
                <text textAnchor="middle" dy={4} fontSize={13}>
                  {EVENT_ICONS[n.eventType] ?? "📍"}
                </text>
                <title>{`${n.title}\n${new Date(n.observedAt).toLocaleString("en-IN")}`}</title>
              </g>
            ))}
          </svg>
          <div className="flex flex-wrap justify-center gap-3 px-4 pb-2 pt-1">
            {Object.entries(RELATION_COLORS).slice(0, 5).map(([k, c]) => (
              <span key={k} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className="h-0.5 w-4 rounded" style={{ background: c }} />
                {k.replaceAll("_", " ").toLowerCase()}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
