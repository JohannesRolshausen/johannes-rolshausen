import { useMemo, useRef, useState } from 'react';
import './SoundCanvasPage.css';

type SoundType = 'kick' | 'snare' | 'hihat' | 'bass' | 'lead' | 'chime';

type CanvasNode = {
  id: string;
  sound: SoundType;
  x: number;
  y: number;
};

type Edge = {
  from: string;
  to: string;
};

const SOUND_LIBRARY: Array<{ sound: SoundType; label: string; colorClass: string }> = [
  { sound: 'kick', label: 'Kick', colorClass: 'node-kick' },
  { sound: 'snare', label: 'Snare', colorClass: 'node-snare' },
  { sound: 'hihat', label: 'HiHat', colorClass: 'node-hihat' },
  { sound: 'bass', label: 'Bass', colorClass: 'node-bass' },
  { sound: 'lead', label: 'Lead', colorClass: 'node-lead' },
  { sound: 'chime', label: 'Chime', colorClass: 'node-chime' },
];

const NODE_WIDTH = 140;
const NODE_HEIGHT = 72;

function buildOrder(nodes: CanvasNode[], edges: Edge[]): string[] | null {
  const indegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const node of nodes) {
    indegree.set(node.id, 0);
    graph.set(node.id, []);
  }

  for (const edge of edges) {
    graph.get(edge.from)?.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [nodeId, degree] of indegree.entries()) {
    if (degree === 0) queue.push(nodeId);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    for (const next of graph.get(current) ?? []) {
      const nextDegree = (indegree.get(next) ?? 1) - 1;
      indegree.set(next, nextDegree);
      if (nextDegree === 0) queue.push(next);
    }
  }

  if (order.length !== nodes.length) {
    return null;
  }

  return order;
}

export default function SoundCanvasPage() {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedForConnection, setSelectedForConnection] = useState<string | null>(null);
  const [status, setStatus] = useState('Build a pipeline and press RUN.');
  const [activeNodeIds, setActiveNodeIds] = useState<Set<string>>(new Set());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const nodeCounterRef = useRef(1);
  const panRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);
  const dragRef = useRef<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const ensureAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  };

  const addNode = (sound: SoundType) => {
    const id = `S${nodeCounterRef.current}`;
    nodeCounterRef.current += 1;

    const col = (nodes.length % 4) * 170;
    const row = Math.floor(nodes.length / 4) * 110;

    setNodes((prev) => [
      ...prev,
      {
        id,
        sound,
        x: 40 + col,
        y: 40 + row,
      },
    ]);
  };

  const removeNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((node) => node.id !== nodeId));
    setEdges((prev) => prev.filter((edge) => edge.from !== nodeId && edge.to !== nodeId));
    setSelectedForConnection((prev) => (prev === nodeId ? null : prev));
  };

  const onNodePointerDown = (event: React.PointerEvent, nodeId: string) => {
    if (!canvasRef.current) return;
    const node = nodeMap.get(nodeId);
    if (!node) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    dragRef.current = {
      nodeId,
      offsetX: (event.clientX - canvasRect.left) - (node.x + pan.x),
      offsetY: (event.clientY - canvasRect.top) - (node.y + pan.y),
    };

    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    const target = e.target as Element;
    if (target.closest('.sound-node')) return;

    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onCanvasPointerMove = (event: React.PointerEvent) => {
    if (panRef.current) {
      setPan({
        x: panRef.current.startPanX + (event.clientX - panRef.current.startX),
        y: panRef.current.startPanY + (event.clientY - panRef.current.startY),
      });
      return;
    }

    if (!dragRef.current || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - canvasRect.left - dragRef.current.offsetX - pan.x;
    const y = event.clientY - canvasRect.top - dragRef.current.offsetY - pan.y;

    setNodes((prev) =>
      prev.map((node) =>
        node.id === dragRef.current?.nodeId
          ? {
              ...node,
              x,
              y,
            }
          : node,
      ),
    );
  };

  const onCanvasPointerUp = () => {
    dragRef.current = null;
    panRef.current = null;
  };

  const connectNode = (targetId: string) => {
    if (!selectedForConnection) {
      setSelectedForConnection(targetId);
      setStatus(`Selected ${targetId}. Click another block to connect.`);
      return;
    }

    if (selectedForConnection === targetId) {
      setSelectedForConnection(null);
      setStatus('Connection canceled.');
      return;
    }

    setEdges((prev) => {
      const exists = prev.some(
        (edge) => edge.from === selectedForConnection && edge.to === targetId,
      );
      if (exists) return prev;
      return [...prev, { from: selectedForConnection, to: targetId }];
    });

    setStatus(`Connected ${selectedForConnection} → ${targetId}`);
    setSelectedForConnection(null);
  };

  const clearAll = () => {
    setNodes([]);
    setEdges([]);
    setSelectedForConnection(null);
    setStatus('Canvas cleared.');
  };

  const clearLinks = () => {
    setEdges([]);
    setSelectedForConnection(null);
    setStatus('All links removed.');
  };

  const playSound = (ctx: AudioContext, sound: SoundType, at: number) => {
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, at);

    if (sound === 'kick') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, at);
      osc.frequency.exponentialRampToValueAtTime(45, at + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.9, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      osc.connect(gain);
      osc.start(at);
      osc.stop(at + 0.23);
      return;
    }

    if (sound === 'snare') {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const noise = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1200;
      noise.buffer = buffer;
      gain.gain.exponentialRampToValueAtTime(0.7, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
      noise.connect(filter);
      filter.connect(gain);
      noise.start(at);
      noise.stop(at + 0.2);
      return;
    }

    if (sound === 'hihat') {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const noise = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 7000;
      noise.buffer = buffer;
      gain.gain.exponentialRampToValueAtTime(0.5, at + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.08);
      noise.connect(filter);
      filter.connect(gain);
      noise.start(at);
      noise.stop(at + 0.08);
      return;
    }

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    osc.connect(filter);
    filter.connect(gain);

    if (sound === 'bass') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(82.41, at);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, at);
      gain.gain.exponentialRampToValueAtTime(0.6, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      osc.start(at);
      osc.stop(at + 0.35);
      return;
    }

    if (sound === 'lead') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(329.63, at);
      osc.frequency.linearRampToValueAtTime(392.0, at + 0.18);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, at);
      gain.gain.exponentialRampToValueAtTime(0.45, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      osc.start(at);
      osc.stop(at + 0.32);
      return;
    }

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, at);
    osc.frequency.exponentialRampToValueAtTime(880, at + 0.25);
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(600, at);
    gain.gain.exponentialRampToValueAtTime(0.4, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
    osc.start(at);
    osc.stop(at + 0.3);
  };

  const runPipeline = async () => {
    if (nodes.length === 0) {
      setStatus('No blocks yet. Add sounds first.');
      return;
    }

    const order = buildOrder(nodes, edges);
    if (!order) {
      setStatus('Loop detected. Remove circular links and try again.');
      return;
    }

    const audio = ensureAudio();
    if (audio.state === 'suspended') {
      await audio.resume();
    }

    const start = audio.currentTime + 0.05;
    const step = 0.3;

    setStatus(`Running ${order.length} blocks in sequence.`);

    order.forEach((nodeId, index) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;
      const when = start + index * step;
      playSound(audio, node.sound, when);
      window.setTimeout(() => {
        setActiveNodeIds((prev) => new Set(prev).add(nodeId));
      }, index * step * 1000);
      window.setTimeout(() => {
        setActiveNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
      }, index * step * 1000 + 240);
    });
  };

  return (
    <div className="sound-canvas-page">
      <button
        type="button"
        className={`burger-btn ${isMenuOpen ? 'is-open' : ''}`}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-label="Toggle menu"
      >
        <span className="bar"></span>
        <span className="bar"></span>
        <span className="bar"></span>
      </button>

      <header className="sound-header">
        <div>
          <h1>Brutal | Sound | Canvas</h1>
          <p>Drop blocks. Click block A then B to create A → B. RUN executes in graph order.</p>
        </div>
        <div className="header-actions">
          <a href="/" className="home-link">
            Back Home
          </a>
        </div>
      </header>

      <div className="sound-layout">
        <aside className={`sound-palette ${isMenuOpen ? 'is-open' : ''}`}>
          <h2>BLOCKS</h2>
          {SOUND_LIBRARY.map((item) => (
            <button
              key={item.sound}
              type="button"
              className={`palette-btn ${item.colorClass}`}
              onClick={() => addNode(item.sound)}
            >
              + {item.label}
            </button>
          ))}

          <div className="control-group">
            <button type="button" className="action-btn run" onClick={runPipeline}>
              RUN PIPELINE
            </button>
            <button type="button" className="action-btn" onClick={clearLinks}>
              CLEAR LINKS
            </button>
            <button type="button" className="action-btn danger" onClick={clearAll}>
              CLEAR ALL
            </button>
          </div>
          <p className="status">{status}</p>
        </aside>

        <div
          className="canvas-wrap"
          ref={canvasRef}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerLeave={onCanvasPointerUp}
          style={{ backgroundPosition: `${pan.x}px ${pan.y}px` }}
        >
          <div className="canvas-content" style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
            <svg className="edge-layer" aria-hidden="true">
              <defs>
                <marker
                  id="arrow-head"
                  markerWidth="12"
                  markerHeight="12"
                  refX="10"
                  refY="6"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L12,6 L0,12 z" fill="#121212" />
                </marker>
              </defs>
              {edges.map((edge) => {
                const fromNode = nodeMap.get(edge.from);
                const toNode = nodeMap.get(edge.to);
                if (!fromNode || !toNode) return null;

                const x1 = fromNode.x + NODE_WIDTH;
                const y1 = fromNode.y + NODE_HEIGHT / 2;
                const x2 = toNode.x;
                const y2 = toNode.y + NODE_HEIGHT / 2;

                return (
                  <line
                    key={`${edge.from}-${edge.to}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#121212"
                    strokeWidth="4"
                    markerEnd="url(#arrow-head)"
                  />
                );
              })}
            </svg>

            {nodes.map((node) => {
              const colorClass = SOUND_LIBRARY.find((item) => item.sound === node.sound)?.colorClass;
              const isSelected = selectedForConnection === node.id;
              const isActive = activeNodeIds.has(node.id);

              return (
                <div
                  key={node.id}
                  className={`sound-node ${colorClass ?? ''} ${isSelected ? 'selected' : ''} ${
                    isActive ? 'active' : ''
                  }`}
                  style={{ left: node.x, top: node.y }}
                  onPointerDown={(event) => onNodePointerDown(event, node.id)}
                >
                  <div className="node-head">
                    <span>{node.id}</span>
                    <button
                      type="button"
                      className="node-delete"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => removeNode(node.id)}
                      aria-label={`Delete ${node.id}`}
                    >
                      ×
                    </button>
                  </div>
                  <button
                    type="button"
                    className="node-connect"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => connectNode(node.id)}
                  >
                    {node.sound.toUpperCase()}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
