import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * Virtuelles Systembrett – Prototyp-Komponente (v8)
 * ---------------------------------------------------
 * Änderungen gegenüber v7:
 * 1. Zoom-Funktion für das Brett: +/- Buttons und Prozentanzeige über dem
 *    Brett skalieren die maximale Board-Breite zwischen 50% und 150% der
 *    neuen Standardgröße (650px). Der Zoom verändert direkt die tatsächliche
 *    Pixel-Breite des Board-Containers (nicht CSS-transform), damit der
 *    ResizeObserver weiterhin korrekte Werte liefert und Drag/Resize/Rotation
 *    exakt bleiben. Dadurch ragt das Brett auf normalen Bildschirmen nicht
 *    mehr unten aus dem sichtbaren Bereich.
 * 2. Responsives Layout: Ab der Tailwind-"lg"-Breakpoint (≥1024px) stehen
 *    Galerie/Konfigurationsfenster und Brett nebeneinander wie bisher.
 *    Darunter (Tablet/Mobile) wird auf eine vertikale Anordnung umgeschaltet:
 *    Brett zuerst (oben), Galerie/Konfigurationsfenster darunter – über
 *    Flex-Direction-Wechsel und "order"-Utilities gelöst.
 *
 * Abhängigkeiten: nur React + Tailwind CSS (keine externen Libraries nötig)
 */

// ---------- Typen ----------

type ShapeType = "circle" | "square" | "triangle";
type ColorKey = "wood" | "blue" | "red" | "yellow";
type SizeKey = "small" | "large";
type AnchorShape = "rect" | "circle" | "triangle";
type AnchorColorKey = "blue" | "red" | "yellow" | "green" | "gray";
type NoteColorKey = "yellow" | "pink" | "green" | "blue";

interface Figure {
  id: string;
  kind: "figure";
  type: ShapeType;
  label: string;
  x: number; // % relativ zur Board-Breite/-Höhe (Zentrum)
  y: number;
  rotation: number;
  color: ColorKey;
  size: SizeKey;
}

interface Anchor {
  id: string;
  kind: "anchor";
  shape: AnchorShape;
  label: string;
  x: number; // % relativ zur Board-Breite (linke obere Ecke)
  y: number;
  widthPct: number;
  heightPct: number;
  color: AnchorColorKey;
}

interface Note {
  id: string;
  kind: "note";
  text: string;
  x: number; // % relativ zur Board-Breite (linke obere Ecke)
  y: number;
  widthPct: number;
  heightPct: number;
  color: NoteColorKey;
}

// ---------- Konstanten ----------

const COLOR_STYLES: Record<ColorKey, { fill: string; stroke: string; label: string }> = {
  wood: { fill: "#c19a6b", stroke: "#8b6b3d", label: "Holz" },
  blue: { fill: "#3b82f6", stroke: "#1d4ed8", label: "Blau" },
  red: { fill: "#ef4444", stroke: "#b91c1c", label: "Rot" },
  yellow: { fill: "#eab308", stroke: "#a16207", label: "Gelb" },
};

const ANCHOR_COLOR_STYLES: Record<AnchorColorKey, { fill: string; label: string }> = {
  blue: { fill: "#3b82f6", label: "Blau" },
  red: { fill: "#ef4444", label: "Rot" },
  yellow: { fill: "#eab308", label: "Gelb" },
  green: { fill: "#22c55e", label: "Grün" },
  gray: { fill: "#6b7280", label: "Grau" },
};

const NOTE_COLOR_STYLES: Record<NoteColorKey, { bg: string; label: string }> = {
  yellow: { bg: "#fef08a", label: "Gelb" },
  pink: { bg: "#fbcfe8", label: "Rosa" },
  green: { bg: "#bbf7d0", label: "Grün" },
  blue: { bg: "#bfdbfe", label: "Blau" },
};

const ANCHOR_OPACITY = 0.16;

const FIGURE_SIZE_PCT: Record<SizeKey, number> = {
  small: 6,
  large: 9.5,
};

const ANCHOR_MIN_PCT = 6;
const ANCHOR_MAX_PCT = 60;
const ANCHOR_DEFAULT_PCT = 16;

const NOTE_MIN_PCT = 8;
const NOTE_MAX_PCT = 45;
const NOTE_DEFAULT_WIDTH_PCT = 14;
const NOTE_DEFAULT_HEIGHT_PCT = 12;

const SHAPE_LABELS: Record<ShapeType, string> = {
  circle: "Frau",
  square: "Mann",
  triangle: "Element",
};

const ANCHOR_SHAPE_LABELS: Record<AnchorShape, string> = {
  rect: "Bodenanker (Rechteck)",
  circle: "Bodenanker (Kreis)",
  triangle: "Bodenanker (Dreieck)",
};

// Zoom-Konfiguration: Standardgröße 650px, Bereich 50%-150% in 10%-Schritten
const BOARD_BASE_PX = 650;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;
const ZOOM_DEFAULT = 1;

const PANEL_WIDTH = "w-64"; // einheitliche Breite für Galerie + Konfigurationsfenster (Desktop)

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${idCounter++}`;

// ---------- Hook: gemessene Board-Größe in px ----------

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });
    observer.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}

// ---------- Figuren-Icon ----------

interface ShapeSvgProps {
  type: ShapeType;
  color: ColorKey;
  size: number;
  rotation?: number;
  selected?: boolean;
}

const ShapeSvg: React.FC<ShapeSvgProps> = ({ type, color, size, rotation = 0, selected }) => {
  const c = COLOR_STYLES[color];
  const half = size / 2;
  const eyeOffsetY = -half * 0.18;
  const eyeGap = size * 0.14;
  const eyeRadius = Math.max(1.8, size * 0.045);

  const renderBase = () => {
    switch (type) {
      case "circle":
        return <circle cx={0} cy={0} r={half - 2} fill={c.fill} stroke={c.stroke} strokeWidth={2} />;
      case "square":
        return (
          <rect
            x={-half + 2}
            y={-half + 2}
            width={size - 4}
            height={size - 4}
            fill={c.fill}
            stroke={c.stroke}
            strokeWidth={2}
            rx={4}
          />
        );
      case "triangle": {
        const r = half - 2;
        const pts = [
          [0, -r],
          [r * 0.9, r * 0.75],
          [-r * 0.9, r * 0.75],
        ]
          .map((p) => p.join(","))
          .join(" ");
        return <polygon points={pts} fill={c.fill} stroke={c.stroke} strokeWidth={2} />;
      }
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-half} ${-half} ${size} ${size}`}
      className="overflow-visible pointer-events-none select-none"
    >
      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "0 0" }}>
        {renderBase()}
        <circle cx={-eyeGap} cy={eyeOffsetY - half * 0.35} r={eyeRadius} fill={selected ? "#111827" : c.stroke} />
        <circle cx={eyeGap} cy={eyeOffsetY - half * 0.35} r={eyeRadius} fill={selected ? "#111827" : c.stroke} />
      </g>
      {selected && (
        <circle cx={0} cy={0} r={half + 4} fill="none" stroke="#111827" strokeWidth={1.5} strokeDasharray="4 3" />
      )}
    </svg>
  );
};

// ---------- Bodenanker-Icon (ohne Rahmen) ----------

interface AnchorSvgProps {
  shape: AnchorShape;
  color: AnchorColorKey;
  selected?: boolean;
}

const AnchorSvg: React.FC<AnchorSvgProps> = ({ shape, color, selected }) => {
  const c = ANCHOR_COLOR_STYLES[color];

  const renderBase = () => {
    switch (shape) {
      case "circle":
        return <ellipse cx={50} cy={50} rx={48} ry={48} fill={c.fill} fillOpacity={ANCHOR_OPACITY} />;
      case "rect":
        return <rect x={2} y={2} width={96} height={96} fill={c.fill} fillOpacity={ANCHOR_OPACITY} rx={4} />;
      case "triangle":
        return <polygon points="50,2 98,96 2,96" fill={c.fill} fillOpacity={ANCHOR_OPACITY} />;
    }
  };

  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible select-none">
      {renderBase()}
      {selected && (
        <rect
          x={-2}
          y={-2}
          width={104}
          height={104}
          fill="none"
          stroke="#111827"
          strokeWidth={1}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
};

const AnchorPreviewSvg: React.FC<{ shape: AnchorShape; color: AnchorColorKey; size: number }> = ({
  shape,
  color,
  size,
}) => (
  <div style={{ width: size, height: size }}>
    <AnchorSvg shape={shape} color={color} />
  </div>
);

const NotePreview: React.FC<{ color: NoteColorKey; size: number }> = ({ color, size }) => (
  <div
    style={{
      width: size,
      height: size,
      backgroundColor: NOTE_COLOR_STYLES[color].bg,
      boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
    }}
    className="rounded-sm flex items-center justify-center"
  >
    <div className="w-2/3 space-y-0.5">
      <div className="h-0.5 bg-black/10 rounded" />
      <div className="h-0.5 bg-black/10 rounded w-4/5" />
    </div>
  </div>
);

// ---------- Zoom-Kontrolle ----------

interface ZoomControlProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

const ZoomControl: React.FC<ZoomControlProps> = ({ zoom, onZoomIn, onZoomOut, onReset }) => (
  <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-sm px-2 py-1">
    <button
      onClick={onZoomOut}
      disabled={zoom <= ZOOM_MIN + 1e-9}
      title="Verkleinern"
      className="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      −
    </button>
    <button
      onClick={onReset}
      title="Zoom zurücksetzen (100%)"
      className="text-xs text-gray-500 w-12 text-center hover:text-gray-800"
    >
      {Math.round(zoom * 100)}%
    </button>
    <button
      onClick={onZoomIn}
      disabled={zoom >= ZOOM_MAX - 1e-9}
      title="Vergrößern"
      className="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      +
    </button>
  </div>
);

// ---------- Galerie ----------

interface GalleryProps {
  onAddFigure: (type: ShapeType) => void;
  onAddAnchor: (shape: AnchorShape) => void;
  onAddNote: () => void;
  onDragStartTemplate: (e: React.DragEvent, kind: "figure" | "anchor" | "note", value?: ShapeType | AnchorShape) => void;
  splitBoard: boolean;
  onToggleSplit: () => void;
}

const Gallery: React.FC<GalleryProps> = ({
  onAddFigure,
  onAddAnchor,
  onAddNote,
  onDragStartTemplate,
  splitBoard,
  onToggleSplit,
}) => {
  const figureTemplates: ShapeType[] = ["circle", "square", "triangle"];
  const anchorTemplates: AnchorShape[] = ["rect", "circle", "triangle"];

  return (
    <div className="w-full lg:w-64 shrink-0 bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Figuren</h2>
        <p className="text-xs text-gray-400 mb-3">Ziehen oder klicken, um aufs Brett zu setzen</p>
        <div className="flex gap-2">
          {figureTemplates.map((type) => (
            <button
              key={type}
              draggable
              onDragStart={(e) => onDragStartTemplate(e, "figure", type)}
              onClick={() => onAddFigure(type)}
              className="flex items-center justify-center rounded-lg border border-gray-200 p-2.5 hover:bg-gray-50 active:bg-gray-100 cursor-grab active:cursor-grabbing transition-colors"
              title={`${SHAPE_LABELS[type]} hinzufügen`}
            >
              <ShapeSvg type={type} color="wood" size={32} />
            </button>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Bodenanker</h2>
        <p className="text-xs text-gray-400 mb-3">Für Orte, Themen, Ressourcen etc.</p>
        <div className="flex gap-2">
          {anchorTemplates.map((shape) => (
            <button
              key={shape}
              draggable
              onDragStart={(e) => onDragStartTemplate(e, "anchor", shape)}
              onClick={() => onAddAnchor(shape)}
              className="flex items-center justify-center rounded-lg border border-gray-200 p-2.5 hover:bg-gray-50 active:bg-gray-100 cursor-grab active:cursor-grabbing transition-colors"
              title={ANCHOR_SHAPE_LABELS[shape]}
            >
              <AnchorPreviewSvg shape={shape} color="gray" size={32} />
            </button>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Post-its</h2>
        <p className="text-xs text-gray-400 mb-3">Für Notizen, Zitate, Beobachtungen</p>
        <div className="flex gap-2">
          <button
            draggable
            onDragStart={(e) => onDragStartTemplate(e, "note")}
            onClick={onAddNote}
            className="flex items-center justify-center rounded-lg border border-gray-200 p-2.5 hover:bg-gray-50 active:bg-gray-100 cursor-grab active:cursor-grabbing transition-colors"
            title="Post-it hinzufügen"
          >
            <NotePreview color="yellow" size={32} />
          </button>
        </div>
      </div>

      <div className="pt-3 border-t border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Brett</h2>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={splitBoard} onChange={onToggleSplit} className="accent-gray-700" />
          In zwei Hälften teilen
        </label>
      </div>
    </div>
  );
};

// ---------- Kontextpanel: Figur ----------

interface FigurePanelProps {
  figure: Figure;
  onChange: (id: string, patch: Partial<Figure>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const FigurePanel: React.FC<FigurePanelProps> = ({ figure, onChange, onDelete, onClose }) => {
  return (
    <div className="w-full lg:w-64 shrink-0 bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Figur</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">
          ✕ schließen
        </button>
      </div>

      <div className="flex justify-center">
        <ShapeSvg type={figure.type} color={figure.color} size={64} rotation={figure.rotation} selected />
      </div>

      <p className="text-xs text-gray-400 -mt-2 text-center">
        Drehung: {Math.round(figure.rotation)}° — am Ringgriff der Figur ziehen
      </p>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Name</label>
        <input
          value={figure.label}
          onChange={(e) => onChange(figure.id, { label: e.target.value })}
          placeholder="Bezeichnung eingeben…"
          className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-2">Farbe</label>
        <div className="flex gap-2">
          {(Object.keys(COLOR_STYLES) as ColorKey[]).map((key) => (
            <button
              key={key}
              title={COLOR_STYLES[key].label}
              onClick={() => onChange(figure.id, { color: key })}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${
                figure.color === key ? "border-gray-800 scale-110" : "border-gray-200"
              }`}
              style={{ backgroundColor: COLOR_STYLES[key].fill }}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-2">Größe</label>
        <div className="flex gap-2">
          {(["small", "large"] as SizeKey[]).map((key) => (
            <button
              key={key}
              onClick={() => onChange(figure.id, { size: key })}
              className={`flex-1 text-sm rounded-md border px-2 py-1 transition-colors ${
                figure.size === key
                  ? "bg-gray-800 text-white border-gray-800"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {key === "small" ? "Klein" : "Groß"}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onDelete(figure.id)}
        className="mt-2 text-sm text-red-500 hover:text-red-600 border border-red-200 rounded-md py-1.5 hover:bg-red-50 transition-colors"
      >
        Figur entfernen
      </button>
    </div>
  );
};

// ---------- Kontextpanel: Bodenanker ----------

interface AnchorPanelProps {
  anchor: Anchor;
  onChange: (id: string, patch: Partial<Anchor>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const AnchorPanel: React.FC<AnchorPanelProps> = ({ anchor, onChange, onDelete, onClose }) => {
  return (
    <div className="w-full lg:w-64 shrink-0 bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Bodenanker</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">
          ✕ schließen
        </button>
      </div>

      <div className="flex justify-center">
        <div className="w-16 h-16">
          <AnchorSvg shape={anchor.shape} color={anchor.color} selected />
        </div>
      </div>

      <p className="text-xs text-gray-400 -mt-2 text-center">Größe: am Eck-Griff auf dem Brett ziehen</p>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Beschriftung</label>
        <input
          value={anchor.label}
          onChange={(e) => onChange(anchor.id, { label: e.target.value })}
          placeholder="z.B. Ziel, Ressource…"
          className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-2">Farbe</label>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(ANCHOR_COLOR_STYLES) as AnchorColorKey[]).map((key) => (
            <button
              key={key}
              title={ANCHOR_COLOR_STYLES[key].label}
              onClick={() => onChange(anchor.id, { color: key })}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${
                anchor.color === key ? "border-gray-800 scale-110" : "border-gray-200"
              }`}
              style={{ backgroundColor: ANCHOR_COLOR_STYLES[key].fill, opacity: 0.7 }}
            />
          ))}
        </div>
      </div>

      <button
        onClick={() => onDelete(anchor.id)}
        className="mt-2 text-sm text-red-500 hover:text-red-600 border border-red-200 rounded-md py-1.5 hover:bg-red-50 transition-colors"
      >
        Anker entfernen
      </button>
    </div>
  );
};

// ---------- Kontextpanel: Post-it ----------

interface NotePanelProps {
  note: Note;
  onChange: (id: string, patch: Partial<Note>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const NotePanel: React.FC<NotePanelProps> = ({ note, onChange, onDelete, onClose }) => {
  return (
    <div className="w-full lg:w-64 shrink-0 bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Post-it</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">
          ✕ schließen
        </button>
      </div>

      <div className="flex justify-center">
        <div
          style={{ backgroundColor: NOTE_COLOR_STYLES[note.color].bg, width: 72, height: 64 }}
          className="rounded-sm shadow flex items-center justify-center p-1"
        >
          <span className="text-[10px] text-gray-700 text-center line-clamp-3">{note.text || "…"}</span>
        </div>
      </div>

      <p className="text-xs text-gray-400 -mt-2 text-center">Größe: am Eck-Griff auf dem Brett ziehen</p>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Text</label>
        <textarea
          value={note.text}
          onChange={(e) => onChange(note.id, { text: e.target.value })}
          placeholder="Notiz eingeben…"
          rows={4}
          className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-2">Farbe</label>
        <div className="flex gap-2">
          {(Object.keys(NOTE_COLOR_STYLES) as NoteColorKey[]).map((key) => (
            <button
              key={key}
              title={NOTE_COLOR_STYLES[key].label}
              onClick={() => onChange(note.id, { color: key })}
              className={`w-7 h-7 rounded-sm border-2 transition-transform ${
                note.color === key ? "border-gray-800 scale-110" : "border-gray-200"
              }`}
              style={{ backgroundColor: NOTE_COLOR_STYLES[key].bg }}
            />
          ))}
        </div>
      </div>

      <button
        onClick={() => onDelete(note.id)}
        className="mt-2 text-sm text-red-500 hover:text-red-600 border border-red-200 rounded-md py-1.5 hover:bg-red-50 transition-colors"
      >
        Post-it entfernen
      </button>
    </div>
  );
};

// ---------- Figur auf dem Brett (zentrumsbasiert) ----------

interface BoardFigureProps {
  figure: Figure;
  boardSizePx: { width: number; height: number };
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onMove: (id: string, xPct: number, yPct: number) => void;
  onRotate: (id: string, rotation: number) => void;
  boardRef: React.RefObject<HTMLDivElement>;
}

const BoardFigure: React.FC<BoardFigureProps> = ({
  figure,
  boardSizePx,
  isSelected,
  onSelect,
  onRename,
  onMove,
  onRotate,
  boardRef,
}) => {
  const [editingLabel, setEditingLabel] = useState(false);
  const [draft, setDraft] = useState(figure.label);
  const [dragging, setDragging] = useState(false);
  const [rotating, setRotating] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  const size = (FIGURE_SIZE_PCT[figure.size] / 100) * Math.max(boardSizePx.width, 1);

  const commitRename = () => {
    setEditingLabel(false);
    onRename(figure.id, draft.trim());
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (editingLabel) return;
    e.stopPropagation();
    onSelect(figure.id);
    setDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    onMove(figure.id, Math.min(99, Math.max(1, xPct)), Math.min(99, Math.max(1, yPct)));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const handleRotateStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect(figure.id);
    setRotating(true);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handleRotateMove = (e: React.PointerEvent) => {
    if (!rotating) return;
    const node = nodeRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const rad = Math.atan2(dx, -dy);
    let deg = (rad * 180) / Math.PI;
    deg = ((deg % 360) + 360) % 360;
    onRotate(figure.id, deg);
  };

  const handleRotateEnd = (e: React.PointerEvent) => {
    setRotating(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const handleLabelToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(figure.label);
    setEditingLabel(true);
  };

  const half = size / 2;
  const handleDistance = half + 14;

  return (
    <div
      ref={nodeRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={handleLabelToggle}
      style={{
        position: "absolute",
        left: `${figure.x}%`,
        top: `${figure.y}%`,
        transform: "translate(-50%, -50%)",
        cursor: dragging ? "grabbing" : "grab",
        touchAction: "none",
        zIndex: dragging || rotating ? 30 : isSelected ? 20 : 10,
      }}
      className="flex flex-col items-center select-none"
    >
      <div style={{ position: "relative", width: size, height: size }}>
        <ShapeSvg type={figure.type} color={figure.color} size={size} rotation={figure.rotation} selected={isSelected} />

        {isSelected && !editingLabel && (
          <div
            onPointerDown={handleRotateStart}
            onPointerMove={handleRotateMove}
            onPointerUp={handleRotateEnd}
            title="Ziehen, um die Blickrichtung zu drehen"
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 16,
              height: 16,
              marginLeft: -8,
              marginTop: -8,
              transform: `rotate(${figure.rotation}deg) translateY(-${handleDistance}px)`,
              touchAction: "none",
              cursor: rotating ? "grabbing" : "grab",
              zIndex: 40,
            }}
            className="rounded-full bg-white border-2 border-gray-700 shadow flex items-center justify-center"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-gray-700" />
          </div>
        )}
      </div>

      {isSelected && (
        <div className="mt-1" onPointerDown={(e) => e.stopPropagation()}>
          {editingLabel ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setDraft(figure.label);
                  setEditingLabel(false);
                }
              }}
              placeholder="Name…"
              className="text-xs text-center border border-gray-300 rounded px-1 py-0.5 w-24 bg-white shadow-sm"
            />
          ) : figure.label ? (
            <span
              onDoubleClick={handleLabelToggle}
              className="text-xs text-gray-700 bg-white/80 rounded px-1.5 py-0.5 whitespace-nowrap shadow-sm cursor-text"
            >
              {figure.label}
            </span>
          ) : (
            <button
              onClick={handleLabelToggle}
              className="text-[10px] text-gray-400 border border-dashed border-gray-300 rounded px-1.5 py-0.5 bg-white/70 hover:text-gray-600 hover:border-gray-400"
            >
              + Label
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ---------- Generischer Hook: Ecken-basiertes Ziehen ----------

function useCornerDrag(
  x: number,
  y: number,
  onMove: (xPct: number, yPct: number) => void,
  boardRef: React.RefObject<HTMLDivElement>
) {
  const [dragging, setDragging] = useState(false);
  const grabOffsetRef = useRef<{ ox: number; oy: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickXPct = ((e.clientX - rect.left) / rect.width) * 100;
    const clickYPct = ((e.clientY - rect.top) / rect.height) * 100;
    grabOffsetRef.current = { ox: clickXPct - x, oy: clickYPct - y };
    setDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !grabOffsetRef.current) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseXPct = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseYPct = ((e.clientY - rect.top) / rect.height) * 100;
    const newX = mouseXPct - grabOffsetRef.current.ox;
    const newY = mouseYPct - grabOffsetRef.current.oy;
    onMove(Math.min(99, Math.max(0, newX)), Math.min(99, Math.max(0, newY)));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    grabOffsetRef.current = null;
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  return { dragging, handlePointerDown, handlePointerMove, handlePointerUp };
}

// ---------- Bodenanker auf dem Brett ----------

interface BoardAnchorProps {
  anchor: Anchor;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, xPct: number, yPct: number) => void;
  onResize: (id: string, widthPct: number, heightPct: number) => void;
  boardRef: React.RefObject<HTMLDivElement>;
}

const BoardAnchor: React.FC<BoardAnchorProps> = ({ anchor, isSelected, onSelect, onMove, onResize, boardRef }) => {
  const { dragging, handlePointerDown, handlePointerMove, handlePointerUp } = useCornerDrag(
    anchor.x,
    anchor.y,
    (x, y) => onMove(anchor.id, x, y),
    boardRef
  );
  const [resizing, setResizing] = useState(false);
  const resizeStartRef = useRef<{ startX: number; startY: number; w: number; h: number } | null>(null);

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect(anchor.id);
    setResizing(true);
    resizeStartRef.current = { startX: e.clientX, startY: e.clientY, w: anchor.widthPct, h: anchor.heightPct };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!resizing || !resizeStartRef.current) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { startX, startY, w, h } = resizeStartRef.current;
    const dxPct = ((e.clientX - startX) / rect.width) * 100;
    const dyPct = ((e.clientY - startY) / rect.height) * 100;
    const newW = Math.min(ANCHOR_MAX_PCT, Math.max(ANCHOR_MIN_PCT, w + dxPct));
    const newH = Math.min(ANCHOR_MAX_PCT, Math.max(ANCHOR_MIN_PCT, h + dyPct));
    onResize(anchor.id, newW, newH);
  };

  const handleResizeEnd = (e: React.PointerEvent) => {
    setResizing(false);
    resizeStartRef.current = null;
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  return (
    <div
      onPointerDown={(e) => {
        onSelect(anchor.id);
        handlePointerDown(e);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        left: `${anchor.x}%`,
        top: `${anchor.y}%`,
        width: `${anchor.widthPct}%`,
        height: `${anchor.heightPct}%`,
        cursor: dragging ? "grabbing" : "grab",
        touchAction: "none",
        zIndex: dragging || resizing ? 9 : isSelected ? 8 : 5,
      }}
      className="select-none"
    >
      <div className="relative w-full h-full">
        <AnchorSvg shape={anchor.shape} color={anchor.color} selected={isSelected} />

        {anchor.label && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-1">
            <span className="text-[11px] leading-tight text-gray-700 text-center bg-white/70 rounded px-1 py-0.5 max-w-full truncate">
              {anchor.label}
            </span>
          </div>
        )}

        {isSelected && (
          <div
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            title="Ziehen, um die Größe zu ändern"
            className="absolute -bottom-2 -right-2 w-4 h-4 rounded-sm bg-white border-2 border-gray-700 shadow"
            style={{ cursor: "nwse-resize", touchAction: "none", zIndex: 40 }}
          />
        )}
      </div>
    </div>
  );
};

// ---------- Post-it auf dem Brett ----------

interface BoardNoteProps {
  note: Note;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, xPct: number, yPct: number) => void;
  onResize: (id: string, widthPct: number, heightPct: number) => void;
  onEditText: (id: string, text: string) => void;
  boardRef: React.RefObject<HTMLDivElement>;
}

const BoardNote: React.FC<BoardNoteProps> = ({ note, isSelected, onSelect, onMove, onResize, onEditText, boardRef }) => {
  const { dragging, handlePointerDown, handlePointerMove, handlePointerUp } = useCornerDrag(
    note.x,
    note.y,
    (x, y) => onMove(note.id, x, y),
    boardRef
  );
  const [resizing, setResizing] = useState(false);
  const [editing, setEditing] = useState(false);
  const resizeStartRef = useRef<{ startX: number; startY: number; w: number; h: number } | null>(null);

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect(note.id);
    setResizing(true);
    resizeStartRef.current = { startX: e.clientX, startY: e.clientY, w: note.widthPct, h: note.heightPct };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!resizing || !resizeStartRef.current) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { startX, startY, w, h } = resizeStartRef.current;
    const dxPct = ((e.clientX - startX) / rect.width) * 100;
    const dyPct = ((e.clientY - startY) / rect.height) * 100;
    const newW = Math.min(NOTE_MAX_PCT, Math.max(NOTE_MIN_PCT, w + dxPct));
    const newH = Math.min(NOTE_MAX_PCT, Math.max(NOTE_MIN_PCT, h + dyPct));
    onResize(note.id, newW, newH);
  };

  const handleResizeEnd = (e: React.PointerEvent) => {
    setResizing(false);
    resizeStartRef.current = null;
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  return (
    <div
      onPointerDown={(e) => {
        if (editing) return;
        onSelect(note.id);
        handlePointerDown(e);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onSelect(note.id);
        setEditing(true);
      }}
      style={{
        position: "absolute",
        left: `${note.x}%`,
        top: `${note.y}%`,
        width: `${note.widthPct}%`,
        height: `${note.heightPct}%`,
        cursor: editing ? "text" : dragging ? "grabbing" : "grab",
        touchAction: "none",
        zIndex: dragging || resizing || editing ? 19 : isSelected ? 18 : 15,
      }}
      className="select-none"
    >
      <div
        className="relative w-full h-full rounded-sm p-1.5 overflow-hidden"
        style={{
          backgroundColor: NOTE_COLOR_STYLES[note.color].bg,
          boxShadow: isSelected ? "0 4px 10px rgba(0,0,0,0.25)" : "0 2px 5px rgba(0,0,0,0.15)",
        }}
      >
        {editing ? (
          <textarea
            autoFocus
            value={note.text}
            onChange={(e) => onEditText(note.id, e.target.value)}
            onBlur={() => setEditing(false)}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full h-full bg-transparent resize-none outline-none text-[11px] text-gray-800 leading-tight"
          />
        ) : (
          <span className="text-[11px] text-gray-800 leading-tight whitespace-pre-wrap break-words">
            {note.text || <span className="text-gray-500 italic">Doppelklick zum Beschriften</span>}
          </span>
        )}

        {isSelected && !editing && (
          <div
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            title="Ziehen, um die Größe zu ändern"
            className="absolute -bottom-2 -right-2 w-4 h-4 rounded-sm bg-white border-2 border-gray-700 shadow"
            style={{ cursor: "nwse-resize", touchAction: "none", zIndex: 40 }}
          />
        )}
      </div>
    </div>
  );
};

// ---------- Hauptkomponente ----------

type Selectable = { id: string; kind: "figure" | "anchor" | "note" } | null;

const Systembrett: React.FC = () => {
  const [figures, setFigures] = useState<Figure[]>([]);
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<Selectable>(null);
  const [splitBoard, setSplitBoard] = useState(false);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const draggedTemplateRef = useRef<{ kind: "figure" | "anchor" | "note"; value?: ShapeType | AnchorShape } | null>(null);

  const { ref: boardRef, size: boardSizePx } = useElementSize<HTMLDivElement>();

  const selectedFigure = selected?.kind === "figure" ? figures.find((f) => f.id === selected.id) ?? null : null;
  const selectedAnchor = selected?.kind === "anchor" ? anchors.find((a) => a.id === selected.id) ?? null : null;
  const selectedNote = selected?.kind === "note" ? notes.find((n) => n.id === selected.id) ?? null : null;

  const clampPercent = (v: number) => Math.min(99, Math.max(1, v));

  const createFigure = useCallback(
    (type: ShapeType, xPct = 50, yPct = 50): Figure => ({
      id: nextId("fig"),
      kind: "figure",
      type,
      label: "",
      x: clampPercent(xPct),
      y: clampPercent(yPct),
      rotation: 0,
      color: "wood",
      size: "large",
    }),
    []
  );

  const createAnchor = useCallback(
    (shape: AnchorShape, xPct = 42, yPct = 42): Anchor => ({
      id: nextId("anchor"),
      kind: "anchor",
      shape,
      label: "",
      x: clampPercent(xPct),
      y: clampPercent(yPct),
      widthPct: ANCHOR_DEFAULT_PCT,
      heightPct: ANCHOR_DEFAULT_PCT,
      color: "gray",
    }),
    []
  );

  const createNote = useCallback(
    (xPct = 42, yPct = 42): Note => ({
      id: nextId("note"),
      kind: "note",
      text: "",
      x: clampPercent(xPct),
      y: clampPercent(yPct),
      widthPct: NOTE_DEFAULT_WIDTH_PCT,
      heightPct: NOTE_DEFAULT_HEIGHT_PCT,
      color: "yellow",
    }),
    []
  );

  const handleAddFigureFromSidebar = (type: ShapeType) => {
    const fig = createFigure(type, 50 + (Math.random() * 20 - 10), 50 + (Math.random() * 20 - 10));
    setFigures((prev) => [...prev, fig]);
    setSelected({ id: fig.id, kind: "figure" });
  };

  const handleAddAnchorFromSidebar = (shape: AnchorShape) => {
    const anchor = createAnchor(40 + Math.random() * 15, 40 + Math.random() * 15);
    setAnchors((prev) => [...prev, anchor]);
    setSelected({ id: anchor.id, kind: "anchor" });
  };

  const handleAddNoteFromSidebar = () => {
    const note = createNote(40 + Math.random() * 15, 40 + Math.random() * 15);
    setNotes((prev) => [...prev, note]);
    setSelected({ id: note.id, kind: "note" });
  };

  const handleTemplateDragStart = (
    e: React.DragEvent,
    kind: "figure" | "anchor" | "note",
    value?: ShapeType | AnchorShape
  ) => {
    draggedTemplateRef.current = { kind, value };
    e.dataTransfer.effectAllowed = "copy";
  };

  const getBoardRelativePosition = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x: clampPercent(x), y: clampPercent(y) };
  };

  const handleBoardDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleBoardDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const template = draggedTemplateRef.current;
    if (!template) return;
    const { x, y } = getBoardRelativePosition(e.clientX, e.clientY);
    if (template.kind === "figure") {
      const fig = createFigure(template.value as ShapeType, x, y);
      setFigures((prev) => [...prev, fig]);
      setSelected({ id: fig.id, kind: "figure" });
    } else if (template.kind === "anchor") {
      const anchor = createAnchor(template.value as AnchorShape, x, y);
      setAnchors((prev) => [...prev, anchor]);
      setSelected({ id: anchor.id, kind: "anchor" });
    } else {
      const note = createNote(x, y);
      setNotes((prev) => [...prev, note]);
      setSelected({ id: note.id, kind: "note" });
    }
    draggedTemplateRef.current = null;
  };

  const handleUpdateFigure = (id: string, patch: Partial<Figure>) => {
    setFigures((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const handleUpdateAnchor = (id: string, patch: Partial<Anchor>) => {
    setAnchors((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const handleUpdateNote = (id: string, patch: Partial<Note>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  const handleMoveFigure = (id: string, xPct: number, yPct: number) => {
    setFigures((prev) => prev.map((f) => (f.id === id ? { ...f, x: xPct, y: yPct } : f)));
  };

  const handleRotateFigure = (id: string, rotation: number) => {
    setFigures((prev) => prev.map((f) => (f.id === id ? { ...f, rotation } : f)));
  };

  const handleMoveAnchor = (id: string, xPct: number, yPct: number) => {
    setAnchors((prev) => prev.map((a) => (a.id === id ? { ...a, x: xPct, y: yPct } : a)));
  };

  const handleResizeAnchor = (id: string, widthPct: number, heightPct: number) => {
    setAnchors((prev) => prev.map((a) => (a.id === id ? { ...a, widthPct, heightPct } : a)));
  };

  const handleMoveNote = (id: string, xPct: number, yPct: number) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, x: xPct, y: yPct } : n)));
  };

  const handleResizeNote = (id: string, widthPct: number, heightPct: number) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, widthPct, heightPct } : n)));
  };

  const handleEditNoteText = (id: string, text: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)));
  };

  const handleRenameFigure = (id: string, label: string) => {
    handleUpdateFigure(id, { label });
  };

  const handleDeleteFigure = (id: string) => {
    setFigures((prev) => prev.filter((f) => f.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const handleDeleteAnchor = (id: string) => {
    setAnchors((prev) => prev.filter((a) => a.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100));
  const handleZoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100));
  const handleZoomReset = () => setZoom(ZOOM_DEFAULT);

  const hasSelection = selected !== null;
  const boardMaxPx = Math.round(BOARD_BASE_PX * zoom);

  return (
    <div className="w-full min-h-screen bg-gray-50 p-4 sm:p-6 flex justify-center">
      {/*
        Responsive Grundlayout:
        - Mobil/Tablet (< lg): flex-col, Brett zuerst (order-1), Galerie/Panel
          danach (order-2) — erreicht über die Reihenfolge im DOM plus
          "flex-col-reverse" wäre eine Alternative, hier stattdessen explizite
          Order-Klassen für Klarheit.
        - Ab lg (≥1024px): flex-row wie bisher, Galerie/Panel links, Brett
          rechts, ursprüngliche DOM-Reihenfolge zählt (order wird zurückgesetzt).
      */}
      <div className="flex flex-col lg:flex-row gap-4 items-center lg:items-start max-w-6xl w-full">
        {/* Arbeitsfläche: steht auf Mobile ZUERST (order-1), auf Desktop rechts (lg:order-2) */}
        <div className="order-1 lg:order-2 w-full flex flex-col items-center gap-2">
          <div style={{ width: "100%", maxWidth: `${boardMaxPx}px` }} className="flex justify-end">
            <ZoomControl zoom={zoom} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={handleZoomReset} />
          </div>

          <div
            ref={boardRef}
            onDragOver={handleBoardDragOver}
            onDrop={handleBoardDrop}
            onClick={() => setSelected(null)}
            className="relative w-full rounded-xl bg-amber-50 border-2 border-amber-200 shadow-inner overflow-hidden"
            style={{
              maxWidth: `${boardMaxPx}px`,
              aspectRatio: "1 / 1",
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(0,0,0,0.015) 0px, rgba(0,0,0,0.015) 1px, transparent 1px, transparent 12px)",
            }}
          >
            {splitBoard && (
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-amber-400/70 -translate-x-1/2 pointer-events-none z-0" />
            )}

            {figures.length === 0 && anchors.length === 0 && notes.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center text-amber-300 text-sm pointer-events-none z-10 text-center px-6">
                Figuren, Bodenanker oder Post-its aus der Galerie hierher ziehen
              </p>
            )}

            {anchors.map((a) => (
              <BoardAnchor
                key={a.id}
                anchor={a}
                isSelected={selected?.id === a.id}
                onSelect={(id) => setSelected({ id, kind: "anchor" })}
                onMove={handleMoveAnchor}
                onResize={handleResizeAnchor}
                boardRef={boardRef}
              />
            ))}

            {notes.map((n) => (
              <BoardNote
                key={n.id}
                note={n}
                isSelected={selected?.id === n.id}
                onSelect={(id) => setSelected({ id, kind: "note" })}
                onMove={handleMoveNote}
                onResize={handleResizeNote}
                onEditText={handleEditNoteText}
                boardRef={boardRef}
              />
            ))}

            {figures.map((fig) => (
              <BoardFigure
                key={fig.id}
                figure={fig}
                boardSizePx={boardSizePx}
                isSelected={selected?.id === fig.id}
                onSelect={(id) => setSelected({ id, kind: "figure" })}
                onRename={handleRenameFigure}
                onMove={handleMoveFigure}
                onRotate={handleRotateFigure}
                boardRef={boardRef}
              />
            ))}
          </div>
        </div>

        {/* Galerie/Konfigurationsfenster: auf Mobile darunter (order-2), auf Desktop links (lg:order-1) */}
        <div className="order-2 lg:order-1 w-full lg:w-64 shrink-0">
          {!hasSelection && (
            <Gallery
              onAddFigure={handleAddFigureFromSidebar}
              onAddAnchor={handleAddAnchorFromSidebar}
              onAddNote={handleAddNoteFromSidebar}
              onDragStartTemplate={handleTemplateDragStart}
              splitBoard={splitBoard}
              onToggleSplit={() => setSplitBoard((s) => !s)}
            />
          )}

          {selectedFigure && (
            <FigurePanel
              figure={selectedFigure}
              onChange={handleUpdateFigure}
              onDelete={handleDeleteFigure}
              onClose={() => setSelected(null)}
            />
          )}
          {selectedAnchor && (
            <AnchorPanel
              anchor={selectedAnchor}
              onChange={handleUpdateAnchor}
              onDelete={handleDeleteAnchor}
              onClose={() => setSelected(null)}
            />
          )}
          {selectedNote && (
            <NotePanel
              note={selectedNote}
              onChange={handleUpdateNote}
              onDelete={handleDeleteNote}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Systembrett;
