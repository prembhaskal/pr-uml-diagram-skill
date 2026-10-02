import {
  Callout,
  Code,
  Divider,
  Grid,
  H1,
  H3,
  Pill,
  Row,
  Stack,
  Stat,
  Text,
  useHostTheme,
  useRef,
  useState,
} from "cursor/canvas";

type Change = "A" | "C" | "R";
type Member = { name: string; change: Change; pr: number };
type Node = {
  id: string;
  label: string;
  file: string;
  lane: number;
  y?: number;
  external?: boolean;
  prs: Record<string, Change>;
  summary: string;
  members: Member[];
};
type Edge = { from: string; to: string; label: string; pr: number; change: Change };
type PRInfo = { n: number; title: string; state: string; base: string; files: number; add: number; del: number; url?: string };
type Note = { tone: "info" | "warning" | "danger" | "success" | "neutral"; title: string; text: string };
type Data = { title: string; subtitle: string; prs: PRInfo[]; lanes: string[]; nodes: Node[]; edges: Edge[]; notes?: Note[] };

const DATA: Data = __DATA__;

type View = number | "all";
type Status = Change | "ctx" | "hidden";
type Pt = { clientX: number; clientY: number };
type Stoppable = { stopPropagation: () => void };

const NW = 210;
const NH = 46;
const LANE_W = 270;
const ROW_GAP = 90;
const TOP = 50;

const ORDER: Record<number, number> = Object.fromEntries(DATA.prs.map((p, i) => [p.n, i + 1]));
const ord = (pr: number) => ORDER[pr] ?? 0;

const laneRows: Record<number, number> = {};
const NODES: (Node & { x: number; y: number })[] = DATA.nodes.map((n) => {
  const row = laneRows[n.lane] ?? 0;
  laneRows[n.lane] = row + 1;
  return { ...n, x: 20 + n.lane * LANE_W, y: n.y ?? TOP + row * ROW_GAP };
});
const W = 20 + DATA.lanes.length * LANE_W;
const H = Math.max(...NODES.map((n) => n.y)) + NH + 40;

function introducedIn(n: Node): number {
  let best = 0;
  for (const [k, v] of Object.entries(n.prs)) if (v === "A" && (!best || ord(Number(k)) < ord(best))) best = Number(k);
  return best;
}

function nodeStatus(n: Node, v: View): Status {
  if (v === "all") {
    const vals = Object.values(n.prs);
    if (vals.includes("A")) return "A";
    if (vals.length) return vals.every((x) => x === "R") ? "R" : "C";
    return "ctx";
  }
  const intro = introducedIn(n);
  if (intro && ord(intro) > ord(v)) return "hidden";
  return n.prs[String(v)] ?? "ctx";
}

function edgeStatus(e: Edge, v: View): Status {
  if (v === "all") return e.change;
  if (ord(e.pr) > ord(v)) return "hidden";
  return e.pr === v ? e.change : "ctx";
}

function clip(cx: number, cy: number, tx: number, ty: number) {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const s = Math.min(dx === 0 ? Infinity : NW / 2 / Math.abs(dx), dy === 0 ? Infinity : NH / 2 / Math.abs(dy));
  return { x: cx + dx * s, y: cy + dy * s };
}

export default function PrUmlDiagram() {
  const t = useHostTheme();
  const [view, setView] = useState<View>("all");
  const [selected, setSelected] = useState<string>(NODES[0]?.id ?? "");
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const colorFor = (s: Status) =>
    s === "A" ? t.diff.stripAdded : s === "C" ? t.category.yellow : s === "R" ? t.diff.stripRemoved : t.stroke.secondary;
  const labelFor = (s: Status) => (s === "A" ? "added" : s === "C" ? "changed" : s === "R" ? "removed" : "unchanged");

  const byId = Object.fromEntries(NODES.map((n) => [n.id, n])) as Record<string, (typeof NODES)[number]>;
  const focus = hover ?? selected;
  const sel = byId[selected];
  const zoomBy = (f: number) => setZoom((z) => Math.min(2.5, Math.max(0.4, z * f)));
  const center = (n: (typeof NODES)[number]) => ({ x: n.x + NW / 2, y: n.y + NH / 2 });

  return (
    <Stack gap={16} style={{ padding: 20 }}>
      <Stack gap={4}>
        <H1>{DATA.title}</H1>
        <Text tone="secondary" size="small">{DATA.subtitle}</Text>
      </Stack>

      <Grid columns={Math.min(DATA.prs.length, 4)} gap={12}>
        {DATA.prs.map((p) => (
          <div
            key={p.n}
            onClick={() => setView(view === p.n ? "all" : p.n)}
            style={{
              cursor: "pointer",
              padding: 12,
              borderRadius: 6,
              border: `1px solid ${view === p.n ? t.accent.primary : t.stroke.tertiary}`,
              background: view === p.n ? t.fill.tertiary : "transparent",
            }}
          >
            <Row justify="space-between">
              <Text weight="semibold">#{p.n}</Text>
              <Text size="small" tone="secondary">{p.state}</Text>
            </Row>
            <Text size="small">{p.title}</Text>
            <Text size="small" tone="tertiary">{p.files} files · +{p.add} −{p.del} · base {p.base}</Text>
          </div>
        ))}
      </Grid>

      <Row gap={8} wrap>
        <Text size="small" tone="secondary">View:</Text>
        {(["all", ...DATA.prs.map((p) => p.n)] as View[]).map((v) => (
          <Pill key={String(v)} active={view === v} onClick={() => setView(v)}>
            {v === "all" ? "All PRs (net)" : `Delta in #${v}`}
          </Pill>
        ))}
        <div style={{ flex: 1 }} />
        {(["A", "C", "R", "ctx"] as Status[]).map((s) => (
          <Row key={s} gap={4} align="center">
            <div style={{ width: 12, height: 12, borderRadius: 2, background: colorFor(s) }} />
            <Text size="small" tone="secondary">{labelFor(s)}</Text>
          </Row>
        ))}
      </Row>

      <Row gap={16} align="start">
        <div
          style={{
            flex: 1,
            minWidth: 0,
            height: 620,
            border: `1px solid ${t.stroke.tertiary}`,
            borderRadius: 6,
            overflow: "hidden",
            position: "relative",
            background: t.bg.editor,
            cursor: "grab",
          }}
          onWheel={(e: { deltaY: number }) => zoomBy(e.deltaY < 0 ? 1.1 : 0.9)}
          onMouseDown={(e: Pt) => (drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y })}
          onMouseMove={(e: Pt) => {
            const d = drag.current;
            if (d) setPan({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y });
          }}
          onMouseUp={() => (drag.current = null)}
          onMouseLeave={() => (drag.current = null)}
        >
          <div style={{ position: "absolute", top: 8, right: 8, zIndex: 2, display: "flex", gap: 4 }}>
            {[
              { l: "+", f: () => zoomBy(1.2) },
              { l: "−", f: () => zoomBy(1 / 1.2) },
              { l: "reset", f: () => { setZoom(0.85); setPan({ x: 0, y: 0 }); } },
            ].map((b) => (
              <button
                key={b.l}
                onMouseDown={(e: Stoppable) => e.stopPropagation()}
                onClick={b.f}
                style={{
                  padding: "2px 8px",
                  background: t.fill.secondary,
                  color: t.text.primary,
                  border: `1px solid ${t.stroke.tertiary}`,
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                {b.l}
              </button>
            ))}
          </div>
          <div style={{ position: "absolute", bottom: 8, left: 10, zIndex: 2 }}>
            <Text size="small" tone="tertiary">scroll = zoom · drag = pan · click a block for details · {Math.round(zoom * 100)}%</Text>
          </div>
          <svg width={W * zoom} height={H * zoom} viewBox={`0 0 ${W} ${H}`} style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
            <defs>
              {(["A", "C", "R", "ctx"] as Status[]).map((s) => (
                <marker key={s} id={`arr-${s}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={colorFor(s)} />
                </marker>
              ))}
            </defs>

            {DATA.lanes.map((title, i) => (
              <g key={title}>
                <rect x={20 + i * LANE_W - 10} y={8} width={NW + 20} height={H - 16} rx={6} fill={t.fill.quaternary} />
                <text x={20 + i * LANE_W} y={26} fill={t.text.tertiary} fontSize={11}>{title}</text>
              </g>
            ))}

            {DATA.edges.map((e, i) => {
              const s = edgeStatus(e, view);
              const a = byId[e.from];
              const b = byId[e.to];
              if (!a || !b || s === "hidden" || nodeStatus(a, view) === "hidden" || nodeStatus(b, view) === "hidden") return null;
              const ca = center(a);
              const cb = center(b);
              const off = DATA.edges.findIndex((o) => o.from === e.from && o.to === e.to) !== i ? 6 : 0;
              const p1 = clip(ca.x, ca.y + off, cb.x, cb.y + off);
              const p2 = clip(cb.x, cb.y + off, ca.x, ca.y + off);
              const lit = focus === e.from || focus === e.to;
              return (
                <g key={i} opacity={lit ? 1 : s === "ctx" ? 0.25 : 0.6}>
                  <line
                    x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    stroke={colorFor(s)}
                    strokeWidth={lit ? 2 : 1.25}
                    strokeDasharray={s === "C" ? "5 3" : s === "R" ? "2 3" : undefined}
                    markerEnd={`url(#arr-${s})`}
                  />
                  {lit && (
                    <text
                      x={(p1.x + p2.x) / 2}
                      y={(p1.y + p2.y) / 2 - 4 + off * 2}
                      fill={t.text.primary}
                      fontSize={10}
                      textAnchor="middle"
                      stroke={t.bg.editor}
                      strokeWidth={3}
                      paintOrder="stroke"
                    >
                      {e.label}
                      {view === "all" && e.pr ? ` (#${e.pr})` : ""}
                    </text>
                  )}
                </g>
              );
            })}

            {NODES.map((n) => {
              const s = nodeStatus(n, view);
              if (s === "hidden") return null;
              const isSel = selected === n.id;
              const tags = Object.entries(n.prs).map(([k, v]) => `#${k}${v}`).join(" ");
              return (
                <g
                  key={n.id}
                  style={{ cursor: "pointer" }}
                  onMouseDown={(e: Stoppable) => e.stopPropagation()}
                  onClick={() => setSelected(n.id)}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover(null)}
                  opacity={s === "ctx" && view !== "all" ? 0.55 : 1}
                >
                  <rect
                    x={n.x} y={n.y} width={NW} height={NH} rx={n.external ? 14 : 4}
                    fill={t.bg.elevated}
                    stroke={isSel ? t.accent.primary : colorFor(s)}
                    strokeWidth={isSel ? 2.5 : 1.5}
                    strokeDasharray={n.external ? "4 3" : undefined}
                  />
                  <rect x={n.x} y={n.y} width={4} height={NH} fill={colorFor(s)} />
                  <text x={n.x + 12} y={n.y + 19} fill={t.text.primary} fontSize={12} fontWeight={600}>{n.label}</text>
                  <text x={n.x + 12} y={n.y + 35} fill={t.text.tertiary} fontSize={10}>{n.external ? n.file : tags || "context"}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {sel && (
          <div style={{ width: 360, flexShrink: 0 }}>
            <Stack gap={10}>
              <Stack gap={2}>
                <H3>{sel.label}</H3>
                <Code>{sel.file}</Code>
              </Stack>
              <Row gap={6} wrap>
                {Object.entries(sel.prs).map(([k, v]) => (
                  <Pill key={k} size="sm" onClick={() => setView(Number(k))}>#{k} {labelFor(v)}</Pill>
                ))}
              </Row>
              <Text size="small">{sel.summary}</Text>

              {sel.members.length > 0 && (
                <>
                  <Divider />
                  <Text size="small" weight="semibold">Members</Text>
                  <Stack gap={4}>
                    {sel.members
                      .filter((m) => view === "all" || m.pr === view)
                      .map((m, i) => (
                        <Row key={i} gap={6} align="start">
                          <div style={{ width: 3, alignSelf: "stretch", background: colorFor(m.change), borderRadius: 1 }} />
                          <Stack gap={0}>
                            <Text size="small" style={{ fontFamily: "monospace", textDecoration: m.change === "R" ? "line-through" : undefined }}>
                              {m.name}
                            </Text>
                            <Text size="small" tone="tertiary">{labelFor(m.change)} in #{m.pr}</Text>
                          </Stack>
                        </Row>
                      ))}
                  </Stack>
                </>
              )}

              <Divider />
              <Text size="small" weight="semibold">Links</Text>
              <Stack gap={4}>
                {DATA.edges
                  .filter((e) => (e.from === sel.id || e.to === sel.id) && (view === "all" || e.pr === view))
                  .map((e, i) => {
                    const other = e.from === sel.id ? e.to : e.from;
                    return (
                      <Row key={i} gap={6} align="start">
                        <div style={{ width: 3, alignSelf: "stretch", background: colorFor(e.change), borderRadius: 1 }} />
                        <Text size="small">
                          {e.from === sel.id ? "→ " : "← "}
                          <span style={{ color: t.text.link, cursor: "pointer" }} onClick={() => setSelected(other)}>
                            {byId[other]?.label ?? other}
                          </span>
                          <span style={{ color: t.text.tertiary }}> · {e.label} · #{e.pr}</span>
                        </Text>
                      </Row>
                    );
                  })}
              </Stack>
            </Stack>
          </div>
        )}
      </Row>

      <Grid columns={4} gap={12}>
        <Stat value={String(NODES.filter((n) => introducedIn(n)).length)} label="new blocks" tone="success" />
        <Stat value={String(NODES.filter((n) => !introducedIn(n) && Object.keys(n.prs).length).length)} label="existing blocks changed" tone="warning" />
        <Stat value={String(DATA.edges.filter((e) => e.change !== "R").length)} label="links added / changed" tone="info" />
        <Stat
          value={String(NODES.reduce((a, n) => a + n.members.filter((m) => m.change === "R").length, 0) + DATA.edges.filter((e) => e.change === "R").length)}
          label="members / links removed"
          tone="danger"
        />
      </Grid>

      {(DATA.notes ?? []).map((n, i) => (
        <Callout key={i} tone={n.tone} title={n.title}>{n.text}</Callout>
      ))}
    </Stack>
  );
}
