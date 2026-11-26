import { SOUND_TYPES, clampPitch, type SoundType } from './audio';

export type CanvasNode = {
  id: string;
  sound: SoundType;
  x: number;
  y: number;
  pitch: number;
};

export type Edge = {
  from: string;
  to: string;
};

export type Graph = {
  nodes: CanvasNode[];
  edges: Edge[];
};

export type Patch = {
  graph: Graph;
  bpm: number;
  loop: boolean;
};

export const NODE_WIDTH = 156;
export const NODE_HEIGHT = 96;

export const MIN_BPM = 60;
export const MAX_BPM = 180;
export const DEFAULT_BPM = 112;

export const EMPTY_GRAPH: Graph = { nodes: [], edges: [] };

export const edgeKey = (edge: Edge) => `${edge.from}->${edge.to}`;

// Step of every node: the longest path from a source block.
// Blocks in a chain play one after another, branches play together.
export function computeSteps(graph: Graph) {
  const steps = new Map<string, number>();
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const node of graph.nodes) {
    indegree.set(node.id, 0);
    outgoing.set(node.id, []);
    steps.set(node.id, 0);
  }
  for (const edge of graph.edges) {
    if (!indegree.has(edge.from) || !indegree.has(edge.to)) continue;
    outgoing.get(edge.from)?.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const queue = graph.nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  let visited = 0;
  let stepCount = graph.nodes.length > 0 ? 1 : 0;

  while (queue.length > 0) {
    const current = queue.shift() as string;
    visited += 1;
    const currentStep = steps.get(current) ?? 0;
    stepCount = Math.max(stepCount, currentStep + 1);
    for (const next of outgoing.get(current) ?? []) {
      steps.set(next, Math.max(steps.get(next) ?? 0, currentStep + 1));
      const remaining = (indegree.get(next) ?? 1) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  return { steps, stepCount, hasCycle: visited !== graph.nodes.length };
}

function reaches(graph: Graph, from: string, target: string) {
  const stack = [from];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === target) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const edge of graph.edges) {
      if (edge.from === current) stack.push(edge.to);
    }
  }
  return false;
}

export type ConnectResult =
  | { ok: true; graph: Graph }
  | { ok: false; reason: 'self' | 'duplicate' | 'loop' };

export function connect(graph: Graph, from: string, to: string): ConnectResult {
  if (from === to) return { ok: false, reason: 'self' };
  if (graph.edges.some((edge) => edge.from === from && edge.to === to)) {
    return { ok: false, reason: 'duplicate' };
  }
  if (reaches(graph, to, from)) return { ok: false, reason: 'loop' };
  return { ok: true, graph: { ...graph, edges: [...graph.edges, { from, to }] } };
}

export function nextNodeId(nodes: CanvasNode[]) {
  const max = nodes.reduce((highest, node) => {
    const value = Number.parseInt(node.id.slice(1), 10);
    return Number.isFinite(value) ? Math.max(highest, value) : highest;
  }, 0);
  return `S${max + 1}`;
}

const overlaps = (nodes: CanvasNode[], x: number, y: number) =>
  nodes.some(
    (node) => Math.abs(node.x - x) < NODE_WIDTH + 12 && Math.abs(node.y - y) < NODE_HEIGHT + 12,
  );

// Nearest free spot around (x, y), scanning a spiral of grid cells
export function findFreeSpot(nodes: CanvasNode[], x: number, y: number) {
  const stepX = NODE_WIDTH + 24;
  const stepY = NODE_HEIGHT + 24;
  for (let ring = 0; ring < 12; ring += 1) {
    for (let dy = -ring; dy <= ring; dy += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const cx = x + dx * stepX;
        const cy = y + dy * stepY;
        if (!overlaps(nodes, cx, cy)) return { x: cx, y: cy };
      }
    }
  }
  return { x, y };
}

// Spot to the right of a node, used when a new block is chained after it
export function spotAfter(nodes: CanvasNode[], anchor: CanvasNode) {
  const x = anchor.x + NODE_WIDTH + 64;
  for (const dy of [0, NODE_HEIGHT + 36, -(NODE_HEIGHT + 36), 2 * (NODE_HEIGHT + 36)]) {
    if (!overlaps(nodes, x, anchor.y + dy)) return { x, y: anchor.y + dy };
  }
  return findFreeSpot(nodes, x, anchor.y);
}

// ---------- patterns ----------

type Voice = [SoundType, number?];
type PatternStep = Voice[];

const COLUMN = NODE_WIDTH + 64;
const ROW = 3 * NODE_HEIGHT + 150;

// First voice of each step forms the main chain, the others branch off it.
// perRow wraps the chain into rows, 2 for phones and 4 for wide screens.
function buildPattern(steps: PatternStep[], perRow: number): Graph {
  const nodes: CanvasNode[] = [];
  const edges: Edge[] = [];
  const spine: string[] = [];
  const branchesAtStart: string[] = [];

  steps.forEach((voices, index) => {
    const row = Math.floor(index / perRow);
    const col = index % perRow;
    const baseX = 40 + col * COLUMN;
    const baseY = 40 + NODE_HEIGHT + 40 + row * ROW;

    voices.forEach(([sound, pitch = 0], voiceIndex) => {
      const id = `S${nodes.length + 1}`;
      const offset = voiceIndex === 0 ? 0 : voiceIndex === 1 ? -1 : 1;
      nodes.push({
        id,
        sound,
        pitch: clampPitch(sound, pitch),
        x: baseX,
        y: baseY + offset * (NODE_HEIGHT + 30),
      });
      if (voiceIndex === 0) {
        if (index > 0) edges.push({ from: spine[index - 1], to: id });
        spine.push(id);
      } else if (index > 0) {
        edges.push({ from: spine[index - 1], to: id });
      } else {
        branchesAtStart.push(id);
      }
    });
  });

  if (spine.length > 1) {
    for (const id of branchesAtStart) edges.push({ from: id, to: spine[1] });
  }

  return { nodes, edges };
}

const DEMO_STEPS: PatternStep[] = [
  [['kick'], ['bass'], ['pad']],
  [['hihat']],
  [['snare'], ['lead', 7]],
  [['hihat'], ['bass', 12]],
  [['kick'], ['bass', -2]],
  [['hihat'], ['chime', 3]],
  [['clap'], ['lead', 10]],
  [['hihat'], ['bass', 3]],
];

export function demoPatch(perRow = 4): Patch {
  return { bpm: 112, loop: true, graph: buildPattern(DEMO_STEPS, perRow) };
}

const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

export function randomPatch(perRow = 4): Patch {
  const steps: PatternStep[] = [];
  const melody = [-5, -2, 0, 3, 5, 7, 10, 12];
  const bassNotes = [-5, -2, 0, 0, 3, 5, 7, 12];

  for (let i = 0; i < 8; i += 1) {
    let main: Voice;
    if (i % 4 === 0) main = ['kick'];
    else if (i % 4 === 2) main = [pick<SoundType>(['snare', 'clap', 'snare'])];
    else main = [pick<SoundType>(['hihat', 'hihat', 'hihat', 'rest', 'kick'])];

    const voices: PatternStep = [main];
    if (i === 0 || Math.random() < 0.45) voices.push(['bass', pick(bassNotes)]);
    const roll = Math.random();
    if (i === 0 && roll < 0.5) voices.push(['pad', pick([0, 3, -5])]);
    else if (roll < 0.3) voices.push(['lead', pick(melody)]);
    else if (roll < 0.42) voices.push(['chime', pick(melody)]);
    steps.push(voices);
  }

  return {
    bpm: pick([96, 104, 112, 120, 128]),
    loop: true,
    graph: buildPattern(steps, perRow),
  };
}

// ---------- persistence ----------

const clampBpm = (bpm: number) =>
  Number.isFinite(bpm) ? Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm))) : DEFAULT_BPM;

type CompactPatch = {
  v: 1;
  b: number;
  l: 0 | 1;
  n: Array<[number, number, number, number]>;
  e: Array<[number, number]>;
};

export function serializePatch(patch: Patch): string {
  const index = new Map(patch.graph.nodes.map((node, i) => [node.id, i]));
  const compact: CompactPatch = {
    v: 1,
    b: patch.bpm,
    l: patch.loop ? 1 : 0,
    n: patch.graph.nodes.map((node) => [
      SOUND_TYPES.indexOf(node.sound),
      Math.round(node.x),
      Math.round(node.y),
      node.pitch,
    ]),
    e: patch.graph.edges
      .filter((edge) => index.has(edge.from) && index.has(edge.to))
      .map((edge) => [index.get(edge.from) as number, index.get(edge.to) as number]),
  };
  return JSON.stringify(compact);
}

// Accepts untrusted input (URL hash, localStorage) and drops anything invalid
export function parsePatch(text: string): Patch | null {
  try {
    const raw = JSON.parse(text) as Partial<CompactPatch>;
    if (!raw || raw.v !== 1 || !Array.isArray(raw.n) || !Array.isArray(raw.e)) return null;

    const nodes: CanvasNode[] = [];
    const ids: Array<string | null> = [];
    for (const entry of raw.n.slice(0, 200)) {
      const [soundIndex, x, y, pitch] = Array.isArray(entry) ? entry : [];
      const sound = SOUND_TYPES[Number(soundIndex)];
      if (!sound || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) {
        ids.push(null);
        continue;
      }
      const id = `S${nodes.length + 1}`;
      ids.push(id);
      nodes.push({
        id,
        sound,
        x: Number(x),
        y: Number(y),
        pitch: clampPitch(sound, Number(pitch)),
      });
    }

    let graph: Graph = { nodes, edges: [] };
    for (const entry of raw.e.slice(0, 600)) {
      if (!Array.isArray(entry)) continue;
      const from = ids[Number(entry[0])];
      const to = ids[Number(entry[1])];
      if (!from || !to) continue;
      const result = connect(graph, from, to);
      if (result.ok) graph = result.graph;
    }

    return { graph, bpm: clampBpm(Number(raw.b)), loop: raw.l !== 0 };
  } catch {
    return null;
  }
}

export function encodeShare(patch: Patch) {
  const bytes = new TextEncoder().encode(serializePatch(patch));
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(token: string): Patch | null {
  try {
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return parsePatch(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
