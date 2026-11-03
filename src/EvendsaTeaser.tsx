import { useEffect, useRef, useState } from 'react';
import './EvendsaTeaser.css';

const EVENDSA_URL = 'https://evendsa.de';

// A crowd mingles across the section until Eva, the evendsa assistant, plans
// the event and every guest walks to a seat on a floor plan. Hovering plans
// it instantly.
const MINGLE_SECONDS = 3.2;
const PLAN_SECONDS = 1.6;
const HOLD_SECONDS = 3.8;
const DISPERSE_SECONDS = 1.2;
const GUEST_STAGGER = 0.8;
const COMPACT_WIDTH = 640;
const FLOOR_SIZES = {
  regular: { spacing: 100, tableRadius: 13, seatRadius: 24 },
  compact: { spacing: 78, tableRadius: 10, seatRadius: 19 },
};
const SEATS_PER_TABLE = 6;
const OBSTACLE_MARGIN = 16;
const EDGE_GAP = 8;
const WANDER_SPEED_MIN = 12;
const WANDER_SPEED_MAX = 30;
const WANDER_TURN_RATE = 2.4;
const LINK_DISTANCE = 48;
const READOUT_UPDATE_MS = 70;
const METER_SEGMENTS = 16;
const INK = '#111111';
const PAPER = '#ffffff';

// The same package evendsa puts together: venue, catering and program.
const TASKS = [
  { label: 'LOCATION', threshold: 0.2 },
  { label: 'CATERING', threshold: 0.5 },
  { label: 'PROGRAM', threshold: 1 },
];

// Every round plans another occasion from the evendsa brief form.
const OCCASIONS = ['TEAM EVENT', 'SUMMER PARTY', 'KICK-OFF', 'ANNIVERSARY', 'XMAS PARTY'];

type Guest = {
  seatX: number;
  seatY: number;
  x: number;
  y: number;
  heading: number;
  speed: number;
  delay: number;
  size: number;
  color: string;
};

type Table = {
  x: number;
  y: number;
  label: string;
};

type Box = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type AgentState = 'idle' | 'planning' | 'done' | 'reset';

const STATUS_LABELS: Record<AgentState, string> = {
  idle: 'STANDBY',
  planning: 'PLANNING',
  done: 'DONE',
  reset: 'RESET',
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - (-2 * value + 2) ** 3 / 2;

const pad = (value: number, length: number) => value.toString().padStart(length, '0');

function EvendsaTeaser() {
  const [isHovering, setIsHovering] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dotsRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const seatedRef = useRef<HTMLDivElement | null>(null);
  const deviceStatusRef = useRef<HTMLSpanElement | null>(null);
  const meterRef = useRef<HTMLDivElement | null>(null);
  const readoutRef = useRef<HTMLDivElement | null>(null);
  const briefRef = useRef<HTMLDivElement | null>(null);
  const taskRefs = useRef<(HTMLLIElement | null)[]>([]);
  const isHoveringRef = useRef(false);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');

    if (!section || !canvas || !context) {
      return;
    }

    let width = 0;
    let height = 0;
    let tableRadius = FLOOR_SIZES.regular.tableRadius;
    let tables: Table[] = [];
    let guests: Guest[] = [];
    let order = 0;
    let target = 0;
    let idleSeconds = 0;
    let holdSeconds = 0;
    let planSeconds = 0;
    let occasionIndex = Math.floor(Math.random() * OCCASIONS.length);
    let animationFrameId = 0;
    let previousTimestamp = 0;
    let lastReadoutUpdate = 0;
    let isMounted = true;

    // Tables never sit under the text, the console, the button or a corner label.
    const readObstacles = (): Box[] => {
      const sectionRect = section.getBoundingClientRect();

      return Array.from(section.querySelectorAll<HTMLElement>('[data-floor-obstacle]')).map((element) => {
        const rect = element.getBoundingClientRect();

        return {
          left: rect.left - sectionRect.left - OBSTACLE_MARGIN,
          top: rect.top - sectionRect.top - OBSTACLE_MARGIN,
          right: rect.right - sectionRect.left + OBSTACLE_MARGIN,
          bottom: rect.bottom - sectionRect.top + OBSTACLE_MARGIN,
        };
      });
    };

    const layout = () => {
      const sectionRect = section.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      width = sectionRect.width;
      height = sectionRect.height;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const { spacing, seatRadius, tableRadius: radius } = width < COMPACT_WIDTH ? FLOOR_SIZES.compact : FLOOR_SIZES.regular;
      const reach = seatRadius + 4;
      const edge = reach + EDGE_GAP;
      const lattice = spacing / 2;
      const columns = Math.floor((width - edge * 2) / lattice);
      const rows = Math.floor((height - edge * 2) / lattice);
      const offsetX = (width - columns * lattice) / 2;
      const offsetY = (height - rows * lattice) / 2;
      const obstacles = readObstacles();

      tableRadius = radius;
      tables = [];

      // Tables snap to a half-step lattice, so the plan stays tidy but can
      // still fill the gaps between the text, the console and the button.
      for (let row = 0; row <= rows; row += 1) {
        for (let column = 0; column <= columns; column += 1) {
          const x = offsetX + column * lattice;
          const y = offsetY + row * lattice;
          const isBlocked = obstacles.some(
            (box) => x + reach > box.left && x - reach < box.right && y + reach > box.top && y - reach < box.bottom,
          );
          const isCrowded = tables.some((table) => Math.hypot(table.x - x, table.y - y) < spacing - 0.5);

          if (!isBlocked && !isCrowded) {
            tables.push({ x, y, label: pad(tables.length + 1, 2) });
          }
        }
      }

      guests = tables.flatMap((table) =>
        Array.from({ length: SEATS_PER_TABLE }, (_, seat) => {
          const angle = (seat / SEATS_PER_TABLE) * Math.PI * 2 + Math.PI / SEATS_PER_TABLE;

          return {
            seatX: table.x + Math.cos(angle) * seatRadius,
            seatY: table.y + Math.sin(angle) * seatRadius,
            x: Math.random() * width,
            y: Math.random() * height,
            heading: Math.random() * Math.PI * 2,
            speed: WANDER_SPEED_MIN + Math.random() * (WANDER_SPEED_MAX - WANDER_SPEED_MIN),
            delay: Math.random() * GUEST_STAGGER,
            size: 2.2 + Math.random() * 1.3,
            color: Math.random() < 0.22 ? PAPER : INK,
          };
        }),
      );

      draw();
      updateReadout();
    };

    const guestBlend = (guest: Guest) => easeInOutCubic(clamp01(order * (1 + GUEST_STAGGER) - guest.delay));

    const wander = (deltaSeconds: number) => {
      for (const guest of guests) {
        guest.heading += (Math.random() - 0.5) * WANDER_TURN_RATE * deltaSeconds * 4;
        guest.x += Math.cos(guest.heading) * guest.speed * deltaSeconds;
        guest.y += Math.sin(guest.heading) * guest.speed * deltaSeconds;

        if (guest.x < 0 || guest.x > width) {
          guest.heading = Math.PI - guest.heading;
          guest.x = Math.min(width, Math.max(0, guest.x));
        }

        if (guest.y < 0 || guest.y > height) {
          guest.heading = -guest.heading;
          guest.y = Math.min(height, Math.max(0, guest.y));
        }
      }
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);

      const planVisibility = easeInOutCubic(order);
      const positions = guests.map((guest) => {
        const blend = guestBlend(guest);

        return {
          x: guest.x + (guest.seatX - guest.x) * blend,
          y: guest.y + (guest.seatY - guest.y) * blend,
          blend,
        };
      });

      // Conversation lines between mingling guests fade out as they sit down.
      if (planVisibility < 1) {
        context.strokeStyle = INK;
        context.lineWidth = 1;

        for (let first = 0; first < positions.length; first += 1) {
          const a = positions[first];

          for (let second = first + 1; second < positions.length; second += 1) {
            const b = positions[second];
            const dx = a.x - b.x;
            const dy = a.y - b.y;

            if (Math.abs(dx) > LINK_DISTANCE || Math.abs(dy) > LINK_DISTANCE) {
              continue;
            }

            const distance = Math.hypot(dx, dy);

            if (distance < LINK_DISTANCE) {
              const closeness = 1 - distance / LINK_DISTANCE;
              context.globalAlpha = 0.28 * closeness * (1 - Math.max(a.blend, b.blend));
              context.beginPath();
              context.moveTo(a.x, a.y);
              context.lineTo(b.x, b.y);
              context.stroke();
            }
          }
        }
      }

      // The floor plan draws itself in while the agent works.
      if (planVisibility > 0) {
        context.strokeStyle = INK;
        context.fillStyle = INK;
        context.lineWidth = 1.5;
        context.font = `700 ${tableRadius < 12 ? 7 : 9}px "Space Mono", monospace`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        for (const table of tables) {
          context.globalAlpha = 0.55 * planVisibility;
          context.beginPath();
          context.arc(table.x, table.y, tableRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * planVisibility);
          context.stroke();

          context.globalAlpha = 0.5 * planVisibility;
          context.fillText(table.label, table.x, table.y + 0.5);
        }
      }

      for (let index = 0; index < guests.length; index += 1) {
        const guest = guests[index];
        const position = positions[index];

        context.globalAlpha = 0.5 + 0.45 * position.blend;
        context.fillStyle = guest.color;
        context.beginPath();
        context.arc(position.x, position.y, guest.size, 0, Math.PI * 2);
        context.fill();
      }

      context.globalAlpha = 1;
    };

    const readState = (): AgentState => {
      if (target === 1) {
        return order >= 1 ? 'done' : 'planning';
      }

      return order > 0 ? 'reset' : 'idle';
    };

    const updateReadout = () => {
      const state = readState();
      const seated = guests.reduce((count, guest) => count + (guestBlend(guest) >= 0.999 ? 1 : 0), 0);
      const total = guests.length;
      const fill = total ? Math.round((seated / total) * METER_SEGMENTS) / METER_SEGMENTS : 0;
      const digits = Math.max(3, total.toString().length);

      section.dataset.agentState = state;

      if (statusRef.current) {
        statusRef.current.textContent = `EVA // ${STATUS_LABELS[state]}`;
      }

      if (deviceStatusRef.current) {
        deviceStatusRef.current.textContent = STATUS_LABELS[state];
      }

      if (seatedRef.current) {
        seatedRef.current.textContent = `SEATED ${pad(seated, digits)}/${pad(total, digits)}`;
      }

      if (meterRef.current) {
        meterRef.current.style.setProperty('--fill', fill.toString());
      }

      if (briefRef.current) {
        briefRef.current.textContent = `> ${OCCASIONS[occasionIndex]} · ${total} PAX`;
      }

      if (readoutRef.current) {
        if (state === 'idle') {
          readoutRef.current.textContent = '> AWAITING BRIEF';
        } else if (state === 'reset') {
          readoutRef.current.textContent = '> NEXT EVENT';
        } else {
          readoutRef.current.textContent = `${state === 'done' ? 'READY IN' : 'T+'} ${planSeconds.toFixed(2)} S`;
        }
      }

      taskRefs.current.forEach((task, index) => {
        if (task) {
          task.dataset.done = String(target === 1 && order >= TASKS[index].threshold);
        }
      });
    };

    const startPlanning = () => {
      target = 1;
      holdSeconds = 0;
      planSeconds = 0;
      occasionIndex = (occasionIndex + 1) % OCCASIONS.length;
    };

    const step = (deltaSeconds: number) => {
      if (isHoveringRef.current) {
        if (target === 0) {
          startPlanning();
        }

        target = 1;
        holdSeconds = 0;
      } else if (target === 1 && order >= 1) {
        holdSeconds += deltaSeconds;

        if (holdSeconds >= HOLD_SECONDS) {
          target = 0;
          idleSeconds = 0;
        }
      } else if (target === 0 && order <= 0) {
        idleSeconds += deltaSeconds;

        if (idleSeconds >= MINGLE_SECONDS) {
          startPlanning();
        }
      }

      if (target === 1) {
        if (order < 1) {
          planSeconds += deltaSeconds;
        }

        order = Math.min(1, order + deltaSeconds / PLAN_SECONDS);
      } else {
        order = Math.max(0, order - deltaSeconds / DISPERSE_SECONDS);
      }

      wander(deltaSeconds);
    };

    const animate = (timestamp: number) => {
      if (!previousTimestamp) {
        previousTimestamp = timestamp;
      }

      const deltaSeconds = Math.min((timestamp - previousTimestamp) / 1000, 0.1);
      previousTimestamp = timestamp;

      step(deltaSeconds);
      draw();

      if (timestamp - lastReadoutUpdate >= READOUT_UPDATE_MS) {
        updateReadout();
        lastReadoutUpdate = timestamp;
      }

      animationFrameId = window.requestAnimationFrame(animate);
    };

    const start = () => {
      if (!animationFrameId) {
        previousTimestamp = 0;
        animationFrameId = window.requestAnimationFrame(animate);
      }
    };

    const stop = () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
    };

    const resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(section);

    // The text block changes size once the web fonts arrive.
    document.fonts?.ready.then(() => {
      if (isMounted) {
        layout();
      }
    });

    // Only spend frames while the section is on screen.
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        start();
      } else {
        stop();
      }
    });
    intersectionObserver.observe(section);

    return () => {
      isMounted = false;
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const dots = dotsRef.current;

    if (!section || !dots) {
      return;
    }

    let animationFrameId = 0;
    let latestX = 0;
    let latestY = 0;

    const flushPointerPosition = () => {
      animationFrameId = 0;
      dots.style.setProperty('--cursor-x', `${latestX}px`);
      dots.style.setProperty('--cursor-y', `${latestY}px`);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = section.getBoundingClientRect();
      latestX = event.clientX - rect.left;
      latestY = event.clientY - rect.top;

      if (!animationFrameId) {
        animationFrameId = window.requestAnimationFrame(flushPointerPosition);
      }
    };

    section.addEventListener('pointermove', handlePointerMove, { passive: true });

    return () => {
      section.removeEventListener('pointermove', handlePointerMove);

      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  const handlePointerEnter = () => {
    isHoveringRef.current = true;
    setIsHovering(true);
  };

  const handlePointerLeave = () => {
    isHoveringRef.current = false;
    setIsHovering(false);
  };

  return (
    <section
      ref={sectionRef}
      className={`evendsa-teaser ${isHovering ? 'is-hovering' : ''}`}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <canvas className="evendsa-floor" ref={canvasRef} aria-hidden="true" />
      <div className="evendsa-dots" ref={dotsRef} />

      <div className="tech-details top-left" data-floor-obstacle>SYS.03 // EVENDSA</div>
      <div className="tech-details top-right" ref={statusRef} data-floor-obstacle>EVA // STANDBY</div>
      <div className="tech-details bottom-left" data-floor-obstacle>
        <span className="evendsa-city">SAARBRÜCKEN </span>49°14′N 6°59′E
      </div>
      <div className="tech-details bottom-right" ref={seatedRef} data-floor-obstacle>SEATED 000/000</div>

      <div className="evendsa-content">
        <div className="teaser-text evendsa-text" data-floor-obstacle>
          <h2 className="tech-font">
            <span className="evendsa-title-prefix">Founder //</span>{' '}
            <span className="evendsa-title-accent">
              evendsa<span className="evendsa-cursor" aria-hidden="true" />
            </span>
          </h2>
          <p>Corporate events in Saarland, planned in seconds. Eva, our AI assistant, bundles venue, catering and program into one package.</p>
        </div>

        <div className="evendsa-device" aria-hidden="true" data-floor-obstacle>
          <div className="evendsa-device-bar">
            <span className="evendsa-led" />
            <span>EVA.01</span>
            <span className="evendsa-device-status" ref={deviceStatusRef}>STANDBY</span>
          </div>
          <div className="evendsa-screen">
            <div className="evendsa-brief" ref={briefRef}>&gt; TEAM EVENT</div>
            <ul className="evendsa-tasks">
              {TASKS.map((task, index) => (
                <li
                  key={task.label}
                  data-done="false"
                  ref={(element) => {
                    taskRefs.current[index] = element;
                  }}
                >
                  <span>{task.label}</span>
                  <span className="evendsa-task-leader" />
                  <span className="evendsa-task-state" />
                </li>
              ))}
            </ul>
            <div className="evendsa-meter" ref={meterRef} />
            <div className="evendsa-readout" ref={readoutRef}>&gt; AWAITING BRIEF</div>
          </div>
        </div>

        <a
          href={EVENDSA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="brutal-button evendsa-button"
          data-floor-obstacle
        >
          Visit evendsa <span className="arrow">↗</span>
        </a>
      </div>
    </section>
  );
}

export default EvendsaTeaser;
