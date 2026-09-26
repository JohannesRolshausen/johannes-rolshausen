import { useEffect, useRef, useState } from 'react';
import './PolarisTeaser.css';

const POLARIS_URL = 'https://polaris-labs.de';

// The sky turns counter-clockwise around Polaris. Hovering the section turns
// the long exposure into a time-lapse.
const BASE_ROTATION_SPEED = 0.045;
const HOVER_ROTATION_SPEED = 0.32;
const SPEED_EASING_PER_SECOND = 3;
const TRAIL_SEGMENTS = 9;
const MIN_TRAIL_RADIUS = 34;
const SIDEREAL_DAY_SECONDS = 86164;
const EXPOSURE_UPDATE_MS = 90;
const STAR_COLORS = ['#2f6bff', '#2f6bff', '#4f86ff', '#8ab4ff', '#eef2ff'];

type TrailStar = {
  radius: number;
  angle: number;
  trailLength: number;
  lineWidth: number;
  color: string;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
};

const pad = (value: number) => value.toString().padStart(2, '0');

const formatExposure = (rotation: number) => {
  const totalSeconds = Math.floor((rotation / (Math.PI * 2)) * SIDEREAL_DAY_SECONDS);
  const hours = Math.floor(totalSeconds / 3600) % 100;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;

  return `EXP ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

function PolarisTeaser() {
  const [isHovering, setIsHovering] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const starRef = useRef<HTMLDivElement | null>(null);
  const exposureRef = useRef<HTMLDivElement | null>(null);
  const isHoveringRef = useRef(false);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const star = starRef.current;
    const context = canvas?.getContext('2d');

    if (!section || !canvas || !star || !context) {
      return;
    }

    let width = 0;
    let height = 0;
    let poleX = 0;
    let poleY = 0;
    let stars: TrailStar[] = [];
    let rotation = 0;
    let speed = BASE_ROTATION_SPEED;
    let animationFrameId = 0;
    let previousTimestamp = 0;
    let lastExposureUpdate = 0;

    const createStar = (maxRadius: number): TrailStar => ({
      radius: MIN_TRAIL_RADIUS + Math.random() ** 0.85 * (maxRadius - MIN_TRAIL_RADIUS),
      angle: Math.random() * Math.PI * 2,
      trailLength: 0.35 + Math.random() * 0.9,
      lineWidth: 0.8 + Math.random() * 1.4,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      alpha: 0.35 + Math.random() * 0.6,
      twinkleSpeed: 1.5 + Math.random() * 3,
      twinklePhase: Math.random() * Math.PI * 2,
    });

    const draw = (timestamp: number) => {
      context.clearRect(0, 0, width, height);
      context.lineCap = 'butt';

      for (const trailStar of stars) {
        const head = trailStar.angle - rotation;
        const step = trailStar.trailLength / TRAIL_SEGMENTS;

        context.strokeStyle = trailStar.color;
        context.fillStyle = trailStar.color;
        context.lineWidth = trailStar.lineWidth;

        // The trail sits behind the head and fades out segment by segment.
        for (let segment = 0; segment < TRAIL_SEGMENTS; segment += 1) {
          const fade = 1 - segment / TRAIL_SEGMENTS;
          context.globalAlpha = trailStar.alpha * fade * fade;
          context.beginPath();
          context.arc(poleX, poleY, trailStar.radius, head + step * segment, head + step * (segment + 1));
          context.stroke();
        }

        const twinkle = 0.65 + 0.35 * Math.sin((timestamp / 1000) * trailStar.twinkleSpeed + trailStar.twinklePhase);
        context.globalAlpha = Math.min(1, trailStar.alpha * 1.2) * twinkle;
        context.beginPath();
        context.arc(
          poleX + Math.cos(head) * trailStar.radius,
          poleY + Math.sin(head) * trailStar.radius,
          trailStar.lineWidth,
          0,
          Math.PI * 2,
        );
        context.fill();
      }

      context.globalAlpha = 1;
    };

    // The pole follows the star mark, so CSS decides where Polaris sits.
    const layout = () => {
      const sectionRect = section.getBoundingClientRect();
      const starRect = star.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      width = sectionRect.width;
      height = sectionRect.height;
      poleX = starRect.left + starRect.width / 2 - sectionRect.left;
      poleY = starRect.top + starRect.height / 2 - sectionRect.top;

      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const maxRadius = Math.max(
        Math.hypot(poleX, poleY),
        Math.hypot(width - poleX, poleY),
        Math.hypot(poleX, height - poleY),
        Math.hypot(width - poleX, height - poleY),
      );
      const starCount = Math.round(Math.min(170, Math.max(60, (width * height) / 5200)));
      stars = Array.from({ length: starCount }, () => createStar(maxRadius));

      draw(performance.now());
    };

    const animate = (timestamp: number) => {
      if (!previousTimestamp) {
        previousTimestamp = timestamp;
      }

      const deltaSeconds = Math.min((timestamp - previousTimestamp) / 1000, 0.1);
      previousTimestamp = timestamp;

      const targetSpeed = isHoveringRef.current ? HOVER_ROTATION_SPEED : BASE_ROTATION_SPEED;
      speed += (targetSpeed - speed) * Math.min(1, deltaSeconds * SPEED_EASING_PER_SECOND);
      rotation += speed * deltaSeconds;

      draw(timestamp);

      if (exposureRef.current && timestamp - lastExposureUpdate >= EXPOSURE_UPDATE_MS) {
        exposureRef.current.textContent = formatExposure(rotation);
        lastExposureUpdate = timestamp;
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
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const grid = gridRef.current;

    if (!section || !grid) {
      return;
    }

    let animationFrameId = 0;
    let latestX = 0;
    let latestY = 0;

    const flushPointerPosition = () => {
      animationFrameId = 0;
      grid.style.setProperty('--cursor-x', `${latestX}px`);
      grid.style.setProperty('--cursor-y', `${latestY}px`);
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
      className={`polaris-teaser ${isHovering ? 'is-hovering' : ''}`}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <canvas className="polaris-sky" ref={canvasRef} aria-hidden="true" />
      <div className="polaris-grid" ref={gridRef} />

      <div className="tech-details top-left">SYS.02 // POLARIS</div>
      <div className="tech-details top-right">RA 02H 31M 49S</div>
      <div className="tech-details bottom-left">DEC +89° 15′ 51″</div>
      <div className="tech-details bottom-right" ref={exposureRef}>EXP 00:00:00</div>

      <div className="polaris-content">
        <div className="teaser-text polaris-text">
          <h2 className="tech-font">
            <span className="polaris-title-prefix">Building //</span>{' '}
            <span className="polaris-title-accent">Polaris Labs</span>
          </h2>
          <p>Where my next ideas take shape. Follow the north star.</p>
        </div>

        <div className="polaris-star" ref={starRef} aria-hidden="true">
          <span className="polaris-star-ring" />
          <svg className="polaris-star-core" viewBox="0 0 100 100">
            <path d="M50 0 L57 43 L100 50 L57 57 L50 100 L43 57 L0 50 L43 43 Z" />
          </svg>
          <span className="polaris-star-label">α UMi</span>
        </div>

        <a
          href={POLARIS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="brutal-button polaris-button"
        >
          Visit Polaris Labs <span className="arrow">↗</span>
        </a>
      </div>
    </section>
  );
}

export default PolarisTeaser;
