import {
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Link } from 'react-router-dom';
import {
  SOUND_DEFS,
  SOUND_LIBRARY,
  createMaster,
  encodeWav,
  pitchLabel,
  playVoice,
  stepPitch,
  stepSeconds,
  type MasterChain,
  type SoundType,
} from './audio';
import {
  DEFAULT_BPM,
  EMPTY_GRAPH,
  MAX_BPM,
  MIN_BPM,
  NODE_HEIGHT,
  NODE_WIDTH,
  computeSteps,
  connect,
  decodeShare,
  demoPatch,
  edgeKey,
  encodeShare,
  findFreeSpot,
  nextNodeId,
  parsePatch,
  randomPatch,
  serializePatch,
  spotAfter,
  type CanvasNode,
  type Graph,
  type Patch,
} from './graph';
import './SoundCanvasPage.css';

type View = { x: number; y: number; scale: number };
type Point = { x: number; y: number };

type Interaction =
  | {
      kind: 'pan';
      pointerId: number;
      start: Point;
      startView: View;
      moved: boolean;
      edge: string | null;
      pointerType: string;
    }
  | { kind: 'node'; pointerId: number; start: Point; nodeId: string; offset: Point; moved: boolean }
  | { kind: 'wire'; pointerId: number; start: Point; fromId: string; moved: boolean }
  | { kind: 'pinch'; startDist: number; startMid: Point; startView: View };

type PlayState = {
  dry: GainNode;
  fx: GainNode;
  nextTime: number;
  step: number;
  endTime: number | null;
  queue: Array<{ time: number; step: number }>;
  timer: number;
  raf: number;
};

type EditorState = { graph: Graph; past: Graph[]; future: Graph[] };
type EditorAction =
  | { type: 'commit'; graph: Graph }
  | { type: 'checkpoint' }
  | { type: 'move'; id: string; x: number; y: number }
  | { type: 'undo' }
  | { type: 'redo' };

const STORAGE_KEY = 'sound-canvas:patch:v2';
const HISTORY_LIMIT = 100;
const MAX_NODES = 200;
const DRAG_THRESHOLD = 5;
const SNAP = 8;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;
const GRID = 32;
const LOOKAHEAD = 0.12;
const TICK_MS = 25;
const MAX_LEDS = 16;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const snap = (value: number) => Math.round(value / SNAP) * SNAP;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

const outPoint = (node: CanvasNode) => ({
  x: node.x + NODE_WIDTH + 11,
  y: node.y + NODE_HEIGHT / 2,
});
const inPoint = (node: CanvasNode) => ({ x: node.x - 8, y: node.y + NODE_HEIGHT / 2 });

// Free cable that follows the pointer while wiring
function cablePath(from: Point, to: Point) {
  const bend = Math.max(48, Math.abs(to.x - from.x) * 0.5);
  return `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`;
}

function roundedPolyline(points: Point[], radius: number) {
  const pts = points.filter((point, i) => i === 0 || distance(point, points[i - 1]) > 0.5);
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const inLen = distance(prev, cur);
    const outLen = distance(cur, next);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const a = {
      x: cur.x - ((cur.x - prev.x) / inLen) * r,
      y: cur.y - ((cur.y - prev.y) / inLen) * r,
    };
    const b = {
      x: cur.x + ((next.x - cur.x) / outLen) * r,
      y: cur.y + ((next.y - cur.y) / outLen) * r,
    };
    d += ` L ${a.x} ${a.y} Q ${cur.x} ${cur.y} ${b.x} ${b.y}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

// Center of the widest horizontal lane between y0 and y1 that no block
// blocks across [xMin, xMax], or null when there is none
function freeLane(nodes: CanvasNode[], xMin: number, xMax: number, y0: number, y1: number) {
  const inRange = nodes.filter((node) => node.x - 14 < xMax && node.x + NODE_WIDTH + 14 > xMin);
  const blocked = (y: number) =>
    inRange.some((node) => node.y - 10 < y && node.y + NODE_HEIGHT + 10 > y);
  let best: number | null = null;
  let bestLength = -1;
  let runStart: number | null = null;
  for (let y = y0; y <= y1; y += 4) {
    if (blocked(y)) {
      runStart = null;
      continue;
    }
    runStart ??= y;
    if (y - runStart > bestLength) {
      bestLength = y - runStart;
      best = (runStart + y) / 2;
    }
  }
  return best;
}

// Orthogonal wire with rounded corners. Backward wires (e.g. from the end of
// one row to the start of the next) look for a free lane between the blocks.
function wirePath(from: Point, to: Point, nodes: CanvasNode[]) {
  const stub = 22;
  if (to.x - from.x >= stub * 2) {
    const midX = (from.x + to.x) / 2;
    return roundedPolyline([from, { x: midX, y: from.y }, { x: midX, y: to.y }, to], 12);
  }
  const half = NODE_HEIGHT / 2;
  const xMin = to.x - stub;
  const xMax = from.x + stub;
  let midY: number | null = null;
  if (to.y - half - (from.y + half) > 24) {
    midY = freeLane(nodes, xMin, xMax, from.y + half + 12, to.y - half - 12);
  } else if (from.y - half - (to.y + half) > 24) {
    midY = freeLane(nodes, xMin, xMax, to.y + half + 12, from.y - half - 12);
  }
  if (midY === null) {
    // no lane in between: run below everything the wire would cross
    const bottom = Math.max(
      from.y + half,
      to.y + half,
      ...nodes
        .filter((node) => node.x - 14 < xMax && node.x + NODE_WIDTH + 14 > xMin)
        .filter((node) => node.y < Math.max(from.y, to.y) + half)
        .map((node) => node.y + NODE_HEIGHT),
    );
    midY = bottom + 24;
  }
  return roundedPolyline(
    [
      from,
      { x: from.x + stub, y: from.y },
      { x: from.x + stub, y: midY },
      { x: to.x - stub, y: midY },
      { x: to.x - stub, y: to.y },
      to,
    ],
    12,
  );
}

function zoomAround(view: View, px: number, py: number, factor: number): View {
  const scale = clamp(view.scale * factor, MIN_ZOOM, MAX_ZOOM);
  const ratio = scale / view.scale;
  return { scale, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio };
}

function fitView(nodes: CanvasNode[], width: number, height: number): View {
  if (nodes.length === 0 || width <= 0 || height <= 0) return { x: 0, y: 0, scale: 1 };
  const minX = Math.min(...nodes.map((node) => node.x)) - 16;
  const minY = Math.min(...nodes.map((node) => node.y)) - 16;
  const maxX = Math.max(...nodes.map((node) => node.x)) + NODE_WIDTH + 24;
  const maxY = Math.max(...nodes.map((node) => node.y)) + NODE_HEIGHT + 16;
  const pad = width < 600 ? 16 : 40;
  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  const widthScale = (width - pad * 2) / contentWidth;
  const heightScale = (height - pad * 2) / contentHeight;
  // on tall, narrow screens a full overview gets unreadable: fit the width
  // and let the rest be reached by panning
  const fitWidth = Math.min(widthScale, heightScale) < 0.55 && heightScale < widthScale;
  const scale = clamp(
    fitWidth ? Math.min(widthScale, 0.9) : Math.min(widthScale, heightScale),
    MIN_ZOOM,
    1.15,
  );
  return {
    scale,
    x: (width - contentWidth * scale) / 2 - minX * scale,
    y: fitWidth ? pad - minY * scale : (height - contentHeight * scale) / 2 - minY * scale,
  };
}

function nodeIdAt(clientX: number, clientY: number) {
  const element = document.elementFromPoint(clientX, clientY);
  return element?.closest('[data-node-id]')?.getAttribute('data-node-id') ?? null;
}

const shareToken = () => window.location.hash.match(/[#&]p=([\w-]+)/)?.[1] ?? null;

const SHARE_LOADED = 'Loaded a shared patch. Press PLAY.';
const SHARE_BROKEN = 'That share link could not be read.';

function loadInitialPatch(): { patch: Patch; message: string; hadShare: boolean } {
  const token = shareToken();
  const shared = token ? decodeShare(token) : null;
  if (shared) return { patch: shared, message: SHARE_LOADED, hadShare: true };
  const prefix = token ? `${SHARE_BROKEN} ` : '';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const patch = saved ? parsePatch(saved) : null;
    if (patch) return { patch, message: `${prefix}Restored your last patch.`, hadShare: !!token };
  } catch {
    // storage blocked (private mode etc.), start empty
  }
  return {
    patch: { graph: EMPTY_GRAPH, bpm: DEFAULT_BPM, loop: true },
    message: `${prefix}Add blocks, wire them up, press PLAY.`,
    hadShare: !!token,
  };
}

const clearShareHash = () =>
  window.history.replaceState(
    window.history.state,
    '',
    window.location.pathname + window.location.search,
  );

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'commit':
      if (action.graph === state.graph) return state;
      return {
        graph: action.graph,
        past: [...state.past, state.graph].slice(-HISTORY_LIMIT),
        future: [],
      };
    case 'checkpoint':
      return { ...state, past: [...state.past, state.graph].slice(-HISTORY_LIMIT), future: [] };
    case 'move':
      return {
        ...state,
        graph: {
          ...state.graph,
          nodes: state.graph.nodes.map((node) =>
            node.id === action.id ? { ...node, x: action.x, y: action.y } : node,
          ),
        },
      };
    case 'undo': {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        graph: previous,
        past: state.past.slice(0, -1),
        future: [state.graph, ...state.future],
      };
    }
    case 'redo': {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return { graph: next, past: [...state.past, state.graph], future: rest };
    }
  }
}

const labelOf = (sound: SoundType) => SOUND_DEFS.get(sound)?.label ?? sound;

export default function SoundCanvasPage() {
  const [boot] = useState(loadInitialPatch);
  const [editor, dispatch] = useReducer(editorReducer, boot.patch.graph, (graph) => ({
    graph,
    past: [],
    future: [],
  }));
  const { graph } = editor;

  const [bpm, setBpm] = useState(boot.patch.bpm);
  const [loop, setLoop] = useState(boot.patch.loop);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [isViewAnimating, setIsViewAnimating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [wire, setWire] = useState<{ fromId: string; x: number; y: number } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ sound: SoundType; x: number; y: number } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playStep, setPlayStep] = useState<number | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState(boot.message);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const paletteDragRef = useRef<{
    pointerId: number;
    start: Point;
    sound: SoundType;
    dragging: boolean;
    dropped: boolean;
  } | null>(null);
  const engineRef = useRef<{ ctx: AudioContext; master: MasterChain } | null>(null);
  const playRef = useRef<PlayState | null>(null);
  const liveRef = useRef({ graph: boot.patch.graph, bpm: boot.patch.bpm, loop: boot.patch.loop });
  const flashTimerRef = useRef(0);
  const viewTimerRef = useRef(0);

  const { steps, stepCount } = useMemo(() => computeSteps(graph), [graph]);
  const nodeMap = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const wires = useMemo(
    () =>
      graph.edges.flatMap((edge) => {
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);
        if (!from || !to) return [];
        return [
          { edge, key: edgeKey(edge), d: wirePath(outPoint(from), inPoint(to), graph.nodes) },
        ];
      }),
    [graph, nodeMap],
  );

  // ---------- effects ----------

  useEffect(() => {
    liveRef.current = { graph, bpm, loop };
  }, [graph, bpm, loop]);

  useEffect(() => {
    engineRef.current?.master.setTempo(bpm);
  }, [bpm]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, serializePatch({ graph, bpm, loop }));
      } catch {
        // storage unavailable, the patch just will not persist
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [graph, bpm, loop]);

  useEffect(() => {
    if (boot.hadShare) clearShareHash();
    const element = canvasRef.current;
    if (!element || boot.patch.graph.nodes.length === 0) return;
    const frame = requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect();
      setView(fitView(boot.patch.graph.nodes, rect.width, rect.height));
    });
    return () => cancelAnimationFrame(frame);
  }, [boot]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1;
      const factor = Math.exp(-event.deltaY * unit * (event.ctrlKey ? 0.01 : 0.0015));
      setView((current) =>
        zoomAround(current, event.clientX - rect.left, event.clientY - rect.top, factor),
      );
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(
    () => () => {
      const play = playRef.current;
      if (play) {
        window.clearInterval(play.timer);
        cancelAnimationFrame(play.raf);
      }
      playRef.current = null;
      window.clearTimeout(flashTimerRef.current);
      window.clearTimeout(viewTimerRef.current);
      const engine = engineRef.current;
      engineRef.current = null;
      engine?.ctx.close().catch(() => undefined);
    },
    [],
  );

  // ---------- audio ----------

  const ensureEngine = async () => {
    if (!engineRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        setStatus('This browser does not support Web Audio.');
        return null;
      }
      const ctx = new Ctor();
      engineRef.current = { ctx, master: createMaster(ctx, liveRef.current.bpm) };
    }
    const engine = engineRef.current;
    if (engine.ctx.state !== 'running') {
      try {
        await engine.ctx.resume();
      } catch {
        // resume can fail without a user gesture, the next click retries
      }
    }
    return engine;
  };

  const flash = (id: string) => {
    setFlashId(id);
    window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlashId(null), 220);
  };

  const audition = async (node: CanvasNode) => {
    flash(node.id);
    const engine = await ensureEngine();
    if (!engine) return;
    playVoice(
      engine.ctx,
      engine.master,
      node.sound,
      engine.ctx.currentTime + 0.01,
      node.pitch,
      stepSeconds(bpm),
    );
  };

  const stopPlayback = (fade = true) => {
    const play = playRef.current;
    if (!play) return;
    playRef.current = null;
    window.clearInterval(play.timer);
    cancelAnimationFrame(play.raf);
    const ctx = engineRef.current?.ctx;
    if (ctx && fade) {
      play.dry.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      play.fx.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    }
    window.setTimeout(
      () => {
        play.dry.disconnect();
        play.fx.disconnect();
      },
      fade ? 400 : 3000,
    );
    setIsPlaying(false);
    setPlayStep(null);
  };

  const startPlayback = async () => {
    if (graph.nodes.length === 0) {
      setStatus('Nothing to play yet. Add a block or load the demo.');
      return;
    }
    const engine = await ensureEngine();
    if (!engine || playRef.current) return;
    const { ctx, master } = engine;

    const dry = ctx.createGain();
    const fx = ctx.createGain();
    dry.connect(master.dry);
    fx.connect(master.fx);

    const play: PlayState = {
      dry,
      fx,
      nextTime: ctx.currentTime + 0.06,
      step: 0,
      endTime: null,
      queue: [],
      timer: 0,
      raf: 0,
    };
    playRef.current = play;

    // Lookahead scheduler: reads the live patch, so edits are heard right away
    const tick = () => {
      if (playRef.current !== play) return;
      const live = liveRef.current;
      const schedule = computeSteps(live.graph);
      const stepDur = stepSeconds(live.bpm);
      if (play.nextTime < ctx.currentTime - 0.05) {
        // the tab was throttled, skip what was missed instead of bursting
        play.nextTime = ctx.currentTime + 0.05;
      }
      while (play.endTime === null && play.nextTime < ctx.currentTime + LOOKAHEAD) {
        if (play.step >= schedule.stepCount) {
          if (live.loop && schedule.stepCount > 0) {
            play.step = 0;
          } else {
            play.endTime = play.nextTime;
            break;
          }
        }
        for (const node of live.graph.nodes) {
          if (schedule.steps.get(node.id) === play.step) {
            playVoice(ctx, { dry, fx }, node.sound, play.nextTime, node.pitch, stepDur);
          }
        }
        play.queue.push({ time: play.nextTime, step: play.step });
        play.nextTime += stepDur;
        play.step += 1;
      }
    };

    const frame = () => {
      if (playRef.current !== play) return;
      const now = ctx.currentTime;
      let current: number | null = null;
      while (play.queue.length > 0 && play.queue[0].time <= now) {
        current = play.queue[0].step;
        play.queue.shift();
      }
      if (current !== null) setPlayStep(current);
      if (play.endTime !== null && now >= play.endTime) {
        stopPlayback(false);
        setStatus('Done. Press PLAY to run it again.');
        return;
      }
      play.raf = requestAnimationFrame(frame);
    };

    tick();
    play.timer = window.setInterval(tick, TICK_MS);
    play.raf = requestAnimationFrame(frame);
    setIsPlaying(true);
    setStatus(
      `Playing ${stepCount} step${stepCount === 1 ? '' : 's'} at ${bpm} BPM${loop ? ' on loop' : ''}.`,
    );
  };

  const togglePlay = () => {
    if (playRef.current) {
      stopPlayback();
      setStatus('Stopped.');
    } else {
      void startPlayback();
    }
  };

  // ---------- view ----------

  const animateView = (next: View) => {
    setIsViewAnimating(true);
    setView(next);
    window.clearTimeout(viewTimerRef.current);
    viewTimerRef.current = window.setTimeout(() => setIsViewAnimating(false), 320);
  };

  const canvasRect = () => canvasRef.current?.getBoundingClientRect() ?? null;

  const patternColumns = () => ((canvasRect()?.width ?? 1000) < 640 ? 2 : 4);

  const localPoint = (event: { clientX: number; clientY: number }): Point => {
    const rect = canvasRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };

  const toWorld = (event: { clientX: number; clientY: number }): Point => {
    const local = localPoint(event);
    return { x: (local.x - view.x) / view.scale, y: (local.y - view.y) / view.scale };
  };

  const fitToContent = (nodes: CanvasNode[] = graph.nodes) => {
    const rect = canvasRect();
    if (!rect) return;
    animateView(
      nodes.length > 0 ? fitView(nodes, rect.width, rect.height) : { x: 0, y: 0, scale: 1 },
    );
  };

  const zoomBy = (factor: number) => {
    const rect = canvasRect();
    if (!rect) return;
    animateView(zoomAround(view, rect.width / 2, rect.height / 2, factor));
  };

  const reveal = (pos: Point) => {
    const rect = canvasRect();
    if (!rect) return;
    const margin = 24;
    const left = pos.x * view.scale + view.x;
    const top = pos.y * view.scale + view.y;
    const right = left + NODE_WIDTH * view.scale;
    const bottom = top + NODE_HEIGHT * view.scale;
    let dx = 0;
    let dy = 0;
    if (left < margin) dx = margin - left;
    else if (right > rect.width - margin) dx = rect.width - margin - right;
    if (top < margin) dy = margin - top;
    else if (bottom > rect.height - margin) dy = rect.height - margin - bottom;
    if (dx !== 0 || dy !== 0) animateView({ ...view, x: view.x + dx, y: view.y + dy });
  };

  // ---------- editing ----------

  const commit = (next: Graph) => dispatch({ type: 'commit', graph: next });

  const resetModes = () => {
    setPendingFrom(null);
    setSelectedEdge(null);
  };

  const addBlock = (sound: SoundType, at?: Point) => {
    if (graph.nodes.length >= MAX_NODES) {
      setStatus(`The canvas is full (${MAX_NODES} blocks).`);
      return;
    }
    const id = nextNodeId(graph.nodes);
    const anchor = at ? undefined : selectedId ? nodeMap.get(selectedId) : undefined;
    let pos: Point;
    if (at) {
      pos = { x: snap(at.x - NODE_WIDTH / 2), y: snap(at.y - NODE_HEIGHT / 2) };
    } else if (anchor) {
      pos = spotAfter(graph.nodes, anchor);
    } else {
      const rect = canvasRect();
      const centerX = rect ? (rect.width / 2 - view.x) / view.scale : 240;
      const centerY = rect ? (rect.height / 2 - view.y) / view.scale : 160;
      pos = findFreeSpot(
        graph.nodes,
        snap(centerX - NODE_WIDTH / 2),
        snap(centerY - NODE_HEIGHT / 2),
      );
    }

    const node: CanvasNode = { id, sound, pitch: 0, x: pos.x, y: pos.y };
    let next: Graph = { ...graph, nodes: [...graph.nodes, node] };
    if (anchor) {
      const result = connect(next, anchor.id, id);
      if (result.ok) next = result.graph;
    }
    commit(next);
    resetModes();
    setSelectedId(id);
    setStatus(
      anchor
        ? `Added ${labelOf(sound)} ${id} after ${anchor.id}.`
        : `Added ${labelOf(sound)} ${id}.`,
    );
    reveal(pos);
    void audition(node);
  };

  const removeNode = (id: string) => {
    commit({
      nodes: graph.nodes.filter((node) => node.id !== id),
      edges: graph.edges.filter((edge) => edge.from !== id && edge.to !== id),
    });
    if (selectedId === id) setSelectedId(null);
    resetModes();
    setStatus(`Removed ${id}. Ctrl+Z brings it back.`);
  };

  const removeEdge = (key: string) => {
    const edge = graph.edges.find((item) => edgeKey(item) === key);
    if (!edge) return;
    commit({ ...graph, edges: graph.edges.filter((item) => item !== edge) });
    setSelectedEdge(null);
    setStatus(`Removed wire ${edge.from} → ${edge.to}.`);
  };

  const changePitch = (id: string, direction: 1 | -1) => {
    const node = nodeMap.get(id);
    if (!node || node.sound === 'rest') return;
    const pitch = stepPitch(node.sound, node.pitch, direction);
    if (pitch === node.pitch) {
      setStatus(`${id} is at its ${direction > 0 ? 'highest' : 'lowest'} pitch.`);
      return;
    }
    const updated = { ...node, pitch };
    commit({ ...graph, nodes: graph.nodes.map((item) => (item.id === id ? updated : item)) });
    setStatus(`${id} → ${pitchLabel(node.sound, pitch)}`);
    void audition(updated);
  };

  const tryConnect = (from: string, to: string) => {
    if (!nodeMap.has(from) || !nodeMap.has(to)) return;
    const result = connect(graph, from, to);
    if (result.ok) {
      commit(result.graph);
      setSelectedId(to);
      setStatus(`Wired ${from} → ${to}.`);
      return;
    }
    if (result.reason === 'duplicate') setStatus(`${from} → ${to} is already wired.`);
    if (result.reason === 'loop') {
      setStatus(`No loops: ${to} already leads to ${from}. Use LOOP to repeat the pattern.`);
    }
  };

  const togglePending = (id: string) => {
    if (pendingFrom === id) {
      setPendingFrom(null);
      setStatus('Wiring canceled.');
      return;
    }
    if (pendingFrom) {
      tryConnect(pendingFrom, id);
      setPendingFrom(null);
      return;
    }
    setSelectedEdge(null);
    setPendingFrom(id);
    setSelectedId(id);
    setStatus(`Wiring from ${id}: tap the block it should trigger next.`);
  };

  const onNodeTap = (id: string) => {
    setSelectedEdge(null);
    if (pendingFrom) {
      if (pendingFrom !== id) tryConnect(pendingFrom, id);
      else setStatus('Wiring canceled.');
      setPendingFrom(null);
      return;
    }
    setSelectedId(id);
    const node = nodeMap.get(id);
    if (node) void audition(node);
  };

  const onBackgroundTap = (edge: string | null, pointerType: string) => {
    if (edge) {
      if (pointerType === 'mouse' || selectedEdge === edge) {
        removeEdge(edge);
      } else {
        setSelectedEdge(edge);
        setStatus('Tap the wire again to remove it.');
      }
      return;
    }
    if (pendingFrom) setStatus('Wiring canceled.');
    resetModes();
    setSelectedId(null);
  };

  const undo = () => {
    if (editor.past.length === 0) return;
    dispatch({ type: 'undo' });
    resetModes();
    setStatus('Undone.');
  };

  const redo = () => {
    if (editor.future.length === 0) return;
    dispatch({ type: 'redo' });
    resetModes();
    setStatus('Redone.');
  };

  const loadPatch = (patch: Patch, message: string) => {
    commit(patch.graph);
    setBpm(patch.bpm);
    setLoop(patch.loop);
    resetModes();
    setSelectedId(null);
    setStatus(message);
    fitToContent(patch.graph.nodes);
  };

  const clearLinks = () => {
    commit({ ...graph, edges: [] });
    resetModes();
    setStatus('All wires removed. Ctrl+Z to undo.');
  };

  const clearAll = () => {
    commit(EMPTY_GRAPH);
    resetModes();
    setSelectedId(null);
    setStatus('Canvas cleared. Ctrl+Z to undo.');
  };

  const sharePatch = async () => {
    if (graph.nodes.length === 0) {
      setStatus('Add some blocks before sharing.');
      return;
    }
    const token = encodeShare({ graph, bpm, loop });
    const url = `${window.location.origin}${window.location.pathname}#p=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Share link copied to the clipboard.');
    } catch {
      window.history.replaceState(window.history.state, '', `#p=${token}`);
      setStatus('Share link is in the address bar now. Copy it from there.');
    }
  };

  const exportWav = async () => {
    if (graph.nodes.length === 0) {
      setStatus('Nothing to export yet.');
      return;
    }
    setIsExporting(true);
    setStatus('Rendering WAV…');
    try {
      const stepDur = stepSeconds(bpm);
      const pass = stepCount * stepDur;
      const passes = loop ? clamp(Math.floor(60 / pass), 1, 4) : 1;
      const sampleRate = 44100;
      const offline = new OfflineAudioContext(
        2,
        Math.ceil((pass * passes + 2.5) * sampleRate),
        sampleRate,
      );
      const master = createMaster(offline, bpm);
      for (let round = 0; round < passes; round += 1) {
        for (const node of graph.nodes) {
          const when = 0.02 + round * pass + (steps.get(node.id) ?? 0) * stepDur;
          playVoice(offline, master, node.sound, when, node.pitch, stepDur);
        }
      }
      const rendered = await offline.startRendering();
      const url = URL.createObjectURL(encodeWav(rendered));
      const link = document.createElement('a');
      link.href = url;
      link.download = `sound-canvas-${bpm}bpm.wav`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      setStatus(`Exported ${passes > 1 ? `${passes} loops` : 'one pass'} as WAV.`);
    } catch {
      setStatus('WAV export is not supported in this browser.');
    } finally {
      setIsExporting(false);
    }
  };

  // ---------- canvas pointer handling ----------

  const onNodePointerDown = (event: ReactPointerEvent<HTMLDivElement>, node: CanvasNode) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if ((event.target as Element).closest('[data-control], [data-port]')) return;
    if (interactionRef.current) return;
    const world = toWorld(event);
    interactionRef.current = {
      kind: 'node',
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      nodeId: node.id,
      offset: { x: world.x - node.x, y: world.y - node.y },
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPortPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (interactionRef.current) return;
    interactionRef.current = {
      kind: 'wire',
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      fromId: id,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  // Every finger on the canvas is tracked here, before blocks and ports see
  // it: a second finger turns whatever the first one does into a pinch zoom,
  // even when it lands on a block.
  const onCanvasPointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return;
    if ((event.target as Element).closest('.sc-zoom, .sc-empty-actions')) return;
    const pointers = pointersRef.current;
    // the first finger of a new gesture: forget anything left over
    if (event.isPrimary) pointers.clear();
    pointers.set(event.pointerId, localPoint(event));
    // keep every finger reporting to the canvas (blocks may re-capture their own)
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointers.size !== 2) return;
    const [a, b] = [...pointers.values()];
    if (interactionRef.current?.kind === 'wire') {
      setWire(null);
      setDropTargetId(null);
    }
    interactionRef.current = {
      kind: 'pinch',
      startDist: Math.max(1, distance(a, b)),
      startMid: midpoint(a, b),
      startView: view,
    };
  };

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (target.closest('.sc-node, .sc-zoom, .sc-empty-actions')) return;
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 1) return;
    if (interactionRef.current) return;
    if (event.button === 1) event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    interactionRef.current = {
      kind: 'pan',
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      startView: view,
      moved: false,
      edge: target.closest('[data-edge]')?.getAttribute('data-edge') ?? null,
      pointerType: event.pointerType,
    };
  };

  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, localPoint(event));
    const interaction = interactionRef.current;
    if (!interaction) return;

    if (interaction.kind === 'pinch') {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const { startView, startMid } = interaction;
      const scale = clamp(
        (startView.scale * distance(a, b)) / interaction.startDist,
        MIN_ZOOM,
        MAX_ZOOM,
      );
      const mid = midpoint(a, b);
      const worldX = (startMid.x - startView.x) / startView.scale;
      const worldY = (startMid.y - startView.y) / startView.scale;
      setView({ scale, x: mid.x - worldX * scale, y: mid.y - worldY * scale });
      return;
    }

    if (event.pointerId !== interaction.pointerId) return;
    if (!interaction.moved) {
      if (
        Math.hypot(event.clientX - interaction.start.x, event.clientY - interaction.start.y) <
        DRAG_THRESHOLD
      ) {
        return;
      }
      interaction.moved = true;
      if (interaction.kind === 'node') dispatch({ type: 'checkpoint' });
    }

    if (interaction.kind === 'pan') {
      setView({
        ...interaction.startView,
        x: interaction.startView.x + event.clientX - interaction.start.x,
        y: interaction.startView.y + event.clientY - interaction.start.y,
      });
      return;
    }

    const world = toWorld(event);
    if (interaction.kind === 'node') {
      dispatch({
        type: 'move',
        id: interaction.nodeId,
        x: snap(world.x - interaction.offset.x),
        y: snap(world.y - interaction.offset.y),
      });
      return;
    }

    setWire({ fromId: interaction.fromId, x: world.x, y: world.y });
    const over = nodeIdAt(event.clientX, event.clientY);
    setDropTargetId(over && over !== interaction.fromId ? over : null);
  };

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    pointersRef.current.delete(event.pointerId);
    const interaction = interactionRef.current;
    if (!interaction) return;

    if (interaction.kind === 'pinch') {
      if (pointersRef.current.size < 2) interactionRef.current = null;
      return;
    }
    if (event.pointerId !== interaction.pointerId) return;
    interactionRef.current = null;

    if (interaction.kind === 'wire') {
      setWire(null);
      setDropTargetId(null);
    }
    if (cancelled) return;

    if (interaction.kind === 'pan') {
      if (!interaction.moved) onBackgroundTap(interaction.edge, interaction.pointerType);
      return;
    }
    if (interaction.kind === 'node') {
      if (!interaction.moved) onNodeTap(interaction.nodeId);
      return;
    }
    if (!interaction.moved) {
      togglePending(interaction.fromId);
      return;
    }
    const targetId = nodeIdAt(event.clientX, event.clientY);
    if (targetId && targetId !== interaction.fromId) tryConnect(interaction.fromId, targetId);
    else setStatus('Drop the wire onto another block to connect it.');
  };

  const onNodeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>, id: string) => {
    if (event.key === 'Enter' && event.target === event.currentTarget) {
      event.preventDefault();
      onNodeTap(id);
    }
  };

  // ---------- palette (tap to add, drag to drop) ----------

  const onPalettePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, sound: SoundType) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    paletteDragRef.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      sound,
      dragging: false,
      dropped: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPalettePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = paletteDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (
      !drag.dragging &&
      Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) < 8
    )
      return;
    drag.dragging = true;
    setGhost({ sound: drag.sound, x: event.clientX, y: event.clientY });
  };

  const onPalettePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = paletteDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !drag.dragging) return;
    setGhost(null);
    drag.dropped = true;
    const rect = canvasRect();
    const inside =
      rect &&
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (inside) addBlock(drag.sound, toWorld(event));
    else setStatus('Drop blocks onto the canvas.');
  };

  const onPalettePointerCancel = () => {
    paletteDragRef.current = null;
    setGhost(null);
  };

  const onPaletteClick = (sound: SoundType) => {
    const drag = paletteDragRef.current;
    paletteDragRef.current = null;
    if (drag?.dropped) return;
    addBlock(sound);
  };

  // pointer clicks should not leave focus on a button, otherwise Space would press it again
  const onPageClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.detail === 0) return;
    (event.target as Element).closest('button')?.blur();
  };

  // ---------- keyboard ----------

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    const key = event.key.toLowerCase();

    if (event.metaKey || event.ctrlKey) {
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === 'y') {
        event.preventDefault();
        redo();
      }
      return;
    }
    if (event.altKey) return;

    if (event.key === ' ') {
      if (target?.closest('button, a, summary')) return;
      event.preventDefault();
      if (!event.repeat) togglePlay();
      return;
    }
    if (event.key === 'Escape') {
      if (interactionRef.current?.kind === 'wire') {
        interactionRef.current = null;
        setWire(null);
        setDropTargetId(null);
      }
      resetModes();
      setSelectedId(null);
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (selectedEdge) {
        event.preventDefault();
        removeEdge(selectedEdge);
      } else if (selectedId && nodeMap.has(selectedId)) {
        event.preventDefault();
        removeNode(selectedId);
      }
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (selectedId && nodeMap.has(selectedId)) {
        event.preventDefault();
        changePitch(selectedId, event.key === 'ArrowUp' ? 1 : -1);
      }
      return;
    }
    if (/^[1-9]$/.test(event.key)) {
      const def = SOUND_LIBRARY[Number(event.key) - 1];
      if (def) addBlock(def.sound);
      return;
    }
    if (key === 'l') {
      setLoop(!loop);
      setStatus(loop ? 'Loop off.' : 'Loop on.');
      return;
    }
    if (key === 'f') fitToContent();
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // a share link pasted into this tab only changes the hash, no reload happens
  const onHashChange = useEffectEvent(() => {
    const token = shareToken();
    if (!token) return;
    const shared = decodeShare(token);
    clearShareHash();
    if (shared) loadPatch(shared, SHARE_LOADED);
    else setStatus(SHARE_BROKEN);
  });

  useEffect(() => {
    const handler = () => onHashChange();
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  // ---------- render ----------

  const wireBox = useMemo(() => {
    const xs = graph.nodes.flatMap((node) => [node.x, node.x + NODE_WIDTH]);
    const ys = graph.nodes.flatMap((node) => [node.y, node.y + NODE_HEIGHT]);
    if (wire) {
      xs.push(wire.x);
      ys.push(wire.y);
    }
    if (xs.length === 0) return { x: 0, y: 0, w: 1, h: 1 };
    const margin = 400;
    const x = Math.min(...xs) - margin;
    const y = Math.min(...ys) - margin;
    return { x, y, w: Math.max(...xs) + margin - x, h: Math.max(...ys) + margin - y };
  }, [graph.nodes, wire]);

  const wireSource = wire ? nodeMap.get(wire.fromId) : undefined;
  const ledCount = Math.min(stepCount, MAX_LEDS);

  return (
    <div className="sc-page" onClick={onPageClick}>
      <header className="sc-header">
        <div className="sc-title">
          <h1>Brutal | Sound | Canvas</h1>
          <p>Wire blocks into a pipeline. A chain plays step by step, branches play together.</p>
        </div>
        <Link to="/" className="sc-home">
          ← Home
        </Link>
      </header>

      <div className="sc-layout">
        <aside className="sc-panel" aria-label="Controls">
          <section className="sc-section sc-transport" aria-label="Transport">
            <div className="sc-transport-row">
              <button
                type="button"
                className={`sc-btn sc-play ${isPlaying ? 'is-playing' : ''}`}
                onClick={togglePlay}
                aria-pressed={isPlaying}
              >
                {isPlaying ? '■ Stop' : '▶ Play'}
              </button>
              <button
                type="button"
                className={`sc-btn sc-toggle ${loop ? 'is-on' : ''}`}
                onClick={() => setLoop(!loop)}
                aria-pressed={loop}
              >
                Loop
              </button>
            </div>
            <label className="sc-tempo">
              <span>Tempo</span>
              <input
                type="range"
                min={MIN_BPM}
                max={MAX_BPM}
                step={1}
                value={bpm}
                onChange={(event) => setBpm(Number(event.target.value))}
              />
              <output>{bpm}</output>
            </label>
          </section>

          <section className="sc-section" aria-label="Blocks">
            <h2>Blocks</h2>
            <div className="sc-palette">
              {SOUND_LIBRARY.map((def, index) => (
                <button
                  key={def.sound}
                  type="button"
                  className={`sc-block-btn sc-c-${def.sound}`}
                  onPointerDown={(event) => onPalettePointerDown(event, def.sound)}
                  onPointerMove={onPalettePointerMove}
                  onPointerUp={onPalettePointerUp}
                  onPointerCancel={onPalettePointerCancel}
                  onClick={() => onPaletteClick(def.sound)}
                  aria-label={`Add ${def.label} block`}
                >
                  <span className="sc-key">{index + 1}</span>
                  {def.label}
                </button>
              ))}
            </div>
            <p className="sc-hint">
              Tap to add or drag onto the canvas. With a block selected, new blocks chain after it.
            </p>
          </section>

          <section className="sc-section" aria-label="Patch">
            <h2>Patch</h2>
            <div className="sc-tools">
              <button
                type="button"
                className="sc-btn"
                onClick={undo}
                disabled={editor.past.length === 0}
              >
                ↶ Undo
              </button>
              <button
                type="button"
                className="sc-btn"
                onClick={redo}
                disabled={editor.future.length === 0}
              >
                ↷ Redo
              </button>
              <button
                type="button"
                className="sc-btn"
                onClick={() => loadPatch(demoPatch(patternColumns()), 'Demo loaded. Press PLAY.')}
              >
                Demo
              </button>
              <button
                type="button"
                className="sc-btn"
                onClick={() =>
                  loadPatch(randomPatch(patternColumns()), 'Fresh random groove. Press PLAY.')
                }
              >
                ⚄ Dice
              </button>
              <button type="button" className="sc-btn" onClick={() => void sharePatch()}>
                Share link
              </button>
              <button
                type="button"
                className="sc-btn"
                onClick={() => void exportWav()}
                disabled={isExporting}
              >
                {isExporting ? 'Rendering…' : 'Export WAV'}
              </button>
              <button
                type="button"
                className="sc-btn"
                onClick={clearLinks}
                disabled={graph.edges.length === 0}
              >
                Clear wires
              </button>
              <button
                type="button"
                className="sc-btn is-danger"
                onClick={clearAll}
                disabled={graph.nodes.length === 0}
              >
                Clear all
              </button>
            </div>
          </section>

          <details className="sc-help">
            <summary>Shortcuts</summary>
            <dl>
              <dt>Space</dt>
              <dd>Play / stop</dd>
              <dt>1–9</dt>
              <dd>Add block</dd>
              <dt>↑ ↓</dt>
              <dd>Pitch of selected block</dd>
              <dt>Del</dt>
              <dd>Delete selection</dd>
              <dt>Ctrl Z</dt>
              <dd>Undo (Shift for redo)</dd>
              <dt>L / F</dt>
              <dd>Loop / fit view</dd>
              <dt>Esc</dt>
              <dd>Cancel</dd>
            </dl>
          </details>
        </aside>

        <div className="sc-stage">
          <div className="sc-lcd">
            <p className="sc-lcd-text" role="status" aria-live="polite">
              {status}
            </p>
            <div className="sc-leds" aria-hidden="true">
              {Array.from({ length: ledCount }, (_, index) => (
                <span key={index} className={`sc-led ${playStep === index ? 'is-on' : ''}`} />
              ))}
              {stepCount > MAX_LEDS && <span className="sc-led-more">+{stepCount - MAX_LEDS}</span>}
            </div>
          </div>
          <div
            ref={canvasRef}
            className={`sc-canvas ${pendingFrom || wire ? 'is-wiring' : ''}`}
            onPointerDownCapture={onCanvasPointerDownCapture}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={(event) => endPointer(event, false)}
            onPointerCancel={(event) => endPointer(event, true)}
            onScroll={(event) => {
              // the view is moved by panning only, never by native scrolling
              event.currentTarget.scrollTop = 0;
              event.currentTarget.scrollLeft = 0;
            }}
            style={{
              backgroundSize: `${GRID * view.scale}px ${GRID * view.scale}px`,
              backgroundPosition: `${view.x}px ${view.y}px`,
            }}
          >
            <div
              className={`sc-world ${isViewAnimating ? 'is-animating' : ''}`}
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
            >
              <svg
                className="sc-wires"
                style={{ left: wireBox.x, top: wireBox.y, width: wireBox.w, height: wireBox.h }}
                viewBox={`${wireBox.x} ${wireBox.y} ${wireBox.w} ${wireBox.h}`}
              >
                <defs>
                  {[
                    ['sc-arrow', '#121212'],
                    ['sc-arrow-hot', '#ff006e'],
                    ['sc-arrow-live', '#00b89c'],
                  ].map(([id, color]) => (
                    <marker
                      key={id}
                      id={id}
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="11"
                      markerHeight="11"
                      markerUnits="userSpaceOnUse"
                      orient="auto"
                    >
                      <path d="M0,0 L10,5 L0,10 z" fill={color} />
                    </marker>
                  ))}
                </defs>

                {wires.map(({ edge, key, d }) => {
                  const isLive = playStep !== null && steps.get(edge.from) === playStep;
                  return (
                    <g
                      key={key}
                      className={`sc-edge ${isLive ? 'is-live' : ''} ${selectedEdge === key ? 'is-selected' : ''}`}
                      data-edge={key}
                    >
                      <path className="sc-edge-hit" d={d}>
                        <title>{`${edge.from} → ${edge.to} (click to remove)`}</title>
                      </path>
                      <path className="sc-edge-line" d={d} />
                    </g>
                  );
                })}

                {wire && wireSource && (
                  <path
                    className="sc-edge-preview"
                    d={cablePath(outPoint(wireSource), { x: wire.x, y: wire.y })}
                  />
                )}
              </svg>

              {graph.nodes.map((node) => {
                const step = steps.get(node.id) ?? 0;
                const classes = [
                  'sc-node',
                  `sc-c-${node.sound}`,
                  selectedId === node.id && 'is-selected',
                  (playStep === step || flashId === node.id) && 'is-active',
                  pendingFrom === node.id && 'is-source',
                  dropTargetId === node.id && 'is-target',
                  pendingFrom && pendingFrom !== node.id && 'is-candidate',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <div
                    key={node.id}
                    className={classes}
                    data-node-id={node.id}
                    style={{ left: node.x, top: node.y }}
                    role="group"
                    aria-label={`${labelOf(node.sound)} block ${node.id}, step ${step + 1}`}
                    onPointerDown={(event) => onNodePointerDown(event, node)}
                  >
                    {/* Tap surface as a sibling of the controls: mobile browsers snap
                        taps to the nearest control, but not away from this layer */}
                    <div
                      className="sc-node-body"
                      tabIndex={0}
                      role="button"
                      aria-label={`Play ${labelOf(node.sound)} ${node.id}`}
                      onKeyDown={(event) => onNodeKeyDown(event, node.id)}
                      onFocus={(event) => {
                        setSelectedId(node.id);
                        // keyboard focus: bring the block into view by panning
                        if (event.currentTarget.matches(':focus-visible')) reveal(node);
                      }}
                    />
                    <span className="sc-port sc-port-in" aria-hidden="true" />
                    <div className="sc-node-head">
                      <span className="sc-node-led" aria-hidden="true" />
                      <span className="sc-node-id">{node.id}</span>
                      <span className="sc-node-step">Step {step + 1}</span>
                      <button
                        type="button"
                        className="sc-node-x"
                        data-control
                        onClick={() => removeNode(node.id)}
                        aria-label={`Delete ${node.id}`}
                      >
                        ×
                      </button>
                    </div>
                    <div className="sc-node-name">{labelOf(node.sound)}</div>
                    {node.sound === 'rest' ? (
                      <div className="sc-node-pitch is-rest">Pause</div>
                    ) : (
                      <div className="sc-node-pitch">
                        <button
                          type="button"
                          data-control
                          onClick={() => changePitch(node.id, -1)}
                          aria-label={`Lower pitch of ${node.id}`}
                        >
                          −
                        </button>
                        <span>{pitchLabel(node.sound, node.pitch)}</span>
                        <button
                          type="button"
                          data-control
                          onClick={() => changePitch(node.id, 1)}
                          aria-label={`Raise pitch of ${node.id}`}
                        >
                          +
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      className="sc-port sc-port-out"
                      data-port
                      onPointerDown={(event) => onPortPointerDown(event, node.id)}
                      onClick={(event) => {
                        if (event.detail === 0) togglePending(node.id);
                      }}
                      aria-label={`Wire ${node.id} to another block`}
                      title="Drag to another block to wire it"
                    />
                  </div>
                );
              })}
            </div>

            {graph.nodes.length === 0 && (
              <div className="sc-empty">
                <p className="sc-empty-title">Empty canvas</p>
                <p>Add blocks from the palette, drag the ● handle to wire them, then press PLAY.</p>
                <div className="sc-empty-actions">
                  <button
                    type="button"
                    className="sc-btn sc-play"
                    onClick={() =>
                      loadPatch(demoPatch(patternColumns()), 'Demo loaded. Press PLAY.')
                    }
                  >
                    Load demo
                  </button>
                  <button
                    type="button"
                    className="sc-btn"
                    onClick={() =>
                      loadPatch(randomPatch(patternColumns()), 'Fresh random groove. Press PLAY.')
                    }
                  >
                    ⚄ Roll the dice
                  </button>
                </div>
              </div>
            )}

            <div className="sc-zoom" aria-label="Zoom">
              <button type="button" onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out">
                −
              </button>
              <button type="button" onClick={() => zoomBy(1 / view.scale)} aria-label="Reset zoom">
                {Math.round(view.scale * 100)}%
              </button>
              <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom in">
                +
              </button>
              <button type="button" onClick={() => fitToContent()} aria-label="Fit all blocks">
                Fit
              </button>
            </div>
          </div>
        </div>
      </div>

      {ghost && (
        <div
          className={`sc-ghost sc-c-${ghost.sound}`}
          style={{ left: ghost.x, top: ghost.y }}
          aria-hidden="true"
        >
          {labelOf(ghost.sound)}
        </div>
      )}
    </div>
  );
}
