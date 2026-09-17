import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import profileImg from './assets/Johannes-Rolshausen.webp';
import { aiRiskQuotes, pickRandomQuoteIndex } from './aiRiskQuotes';
import './App.css';

const pages = [
  { name: 'Sound Canvas', path: '/soundCanvas' },
  { name: 'AI that never hallucinates', path: '/neverHallucinateAI' },
  { name: 'Why AI deserves rights', path: '/aiRights' },
  //{ name: 'Analog Thoughts', path: undefined },
  //{ name: 'Motion Stories', path: undefined },
  //{ name: 'Playground Lab Notes', path: undefined },
];

const CAROUSEL_ITEM_WIDTH = 320;
const CAROUSEL_SPEED_PX_PER_SECOND = 48;
const QUOTE_ROTATION_MS = 14000;
const QUOTE_FADE_MS = 600;
const RIPPLE_INTERVAL_MS = 3000;
const RIPPLE_DURATION_MS = 2600;
const RIPPLE_MAX_RADIUS = 280;
const RIPPLE_SPLASH_PHASE = 0.18;

function App() {
  const [isHovering, setIsHovering] = useState(false);
  const [isCarouselHovering, setIsCarouselHovering] = useState(false);
  const [isTouchHeroAnimating, setIsTouchHeroAnimating] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(() => pickRandomQuoteIndex());
  const [isQuoteFading, setIsQuoteFading] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);
  const gridOverlayRef = useRef<HTMLDivElement | null>(null);
  const coordinatesRef = useRef<HTMLDivElement | null>(null);
  const carouselTrackRef = useRef<HTMLDivElement | null>(null);
  const trackOffsetRef = useRef(-pages.length * CAROUSEL_ITEM_WIDTH);

  const carouselPages = [...pages, ...pages, ...pages];
  const loopDistance = pages.length * CAROUSEL_ITEM_WIDTH;

  const normalizeOffset = (value: number) => {
    let nextOffset = value;

    while (nextOffset >= 0) {
      nextOffset -= loopDistance;
    }

    while (nextOffset < -loopDistance) {
      nextOffset += loopDistance;
    }

    return nextOffset;
  };

  const applyTrackOffset = (value: number) => {
    const normalized = normalizeOffset(value);
    trackOffsetRef.current = normalized;

    if (carouselTrackRef.current) {
      carouselTrackRef.current.style.transform = `translate3d(${normalized}px, 0, 0)`;
    }
  };

  const goToNextSlide = () => {
    applyTrackOffset(trackOffsetRef.current - CAROUSEL_ITEM_WIDTH);
  };

  const goToPrevSlide = () => {
    applyTrackOffset(trackOffsetRef.current + CAROUSEL_ITEM_WIDTH);
  };

  useEffect(() => {
    const hero = heroRef.current;
    const gridOverlay = gridOverlayRef.current;

    if (!hero || !gridOverlay) {
      return;
    }

    let animationFrameId = 0;
    let latestX = 0;
    let latestY = 0;
    let hasPendingUpdate = false;

    const flushPointerPosition = () => {
      animationFrameId = 0;

      if (!hasPendingUpdate) {
        return;
      }

      hasPendingUpdate = false;
      gridOverlay.style.setProperty('--cursor-x', `${latestX}px`);
      gridOverlay.style.setProperty('--cursor-y', `${latestY}px`);

      if (coordinatesRef.current) {
        coordinatesRef.current.textContent = `X: ${Math.round(latestX)} Y: ${Math.round(latestY)}`;
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = hero.getBoundingClientRect();
      latestX = event.clientX - rect.left;
      latestY = event.clientY - rect.top;
      hasPendingUpdate = true;

      if (!animationFrameId) {
        animationFrameId = window.requestAnimationFrame(flushPointerPosition);
      }
    };

    hero.addEventListener('pointermove', handlePointerMove, { passive: true });

    return () => {
      hero.removeEventListener('pointermove', handlePointerMove);

      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    const gridOverlay = gridOverlayRef.current;

    if (!hero || !gridOverlay) {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const touchOnlyMediaQuery = window.matchMedia('(hover: none) and (pointer: coarse)');

    if (!touchOnlyMediaQuery.matches) {
      return;
    }

    gridOverlay.style.setProperty('--grid-size', '20px');

    type FallingPixel = {
      x: number;
      y: number;
      speed: number;
      radius: number;
      drift: number;
    };

    type Ripple = {
      x: number;
      y: number;
      startedAt: number;
    };

    let animationFrameId = 0;
    let previousTimestamp = 0;
    let lastRippleAt = 0;
    let ripples: Ripple[] = [];
    let sceneWidth = 0;
    let sceneHeight = 0;

    const updateScene = () => {
      const rect = hero.getBoundingClientRect();
      sceneWidth = rect.width;
      sceneHeight = rect.height;
    };

    const createPixel = (distributeAcrossHeight = false): FallingPixel => ({
      x: Math.random() * sceneWidth,
      y: distributeAcrossHeight
        ? Math.random() * (sceneHeight + 180) - 180
        : -40 - Math.random() * 180,
      speed: 90 + Math.random() * 160,
      radius: 10 + Math.random() * 12,
      drift: -10 + Math.random() * 20,
    });

    // A drop hits a random spot on the grid: short splash, then an expanding ring
    // (plus a fainter trailing ring) that fades out while it travels.
    const spawnRipple = (timestamp: number) => {
      const margin = Math.min(48, sceneWidth / 4, sceneHeight / 4);
      ripples.push({
        x: margin + Math.random() * (sceneWidth - margin * 2),
        y: margin + Math.random() * (sceneHeight - margin * 2),
        startedAt: timestamp,
      });
      lastRippleAt = timestamp;
    };

    const rippleMaskLayers = (ripple: Ripple, timestamp: number): string[] => {
      const progress = (timestamp - ripple.startedAt) / RIPPLE_DURATION_MS;
      const eased = 1 - (1 - progress) ** 3;
      const alpha = (1 - progress) ** 1.5;
      const radius = eased * RIPPLE_MAX_RADIUS;
      const thickness = 14 + 36 * eased;
      const at = `at ${ripple.x.toFixed(1)}px ${ripple.y.toFixed(1)}px`;
      const ring = (r: number, width: number, a: number) =>
        `radial-gradient(circle ${at}, transparent ${Math.max(0, r - width).toFixed(1)}px, rgba(0,0,0,${a.toFixed(3)}) ${Math.max(0, r - width / 2).toFixed(1)}px, transparent ${(r + width / 2).toFixed(1)}px)`;

      const layers = [ring(radius, thickness, alpha)];

      if (progress > 0.12) {
        layers.push(ring(radius * 0.62, thickness * 0.7, alpha * 0.45));
      }

      if (progress < RIPPLE_SPLASH_PHASE) {
        const splash = progress / RIPPLE_SPLASH_PHASE;
        const splashRadius = 10 + 34 * splash;
        layers.push(
          `radial-gradient(circle ${splashRadius.toFixed(1)}px ${at}, rgba(0,0,0,${(1 - splash).toFixed(3)}) 0%, transparent 100%)`,
        );
      }

      return layers;
    };

    updateScene();

    if (!sceneWidth || !sceneHeight) {
      return;
    }

    const particleCount = Math.max(14, Math.min(24, Math.round(sceneWidth / 22)));
    const particles = Array.from({ length: particleCount }, () => createPixel(true));

    setIsTouchHeroAnimating(true);

    if (coordinatesRef.current) {
      coordinatesRef.current.textContent = 'AUTO // FLOW';
    }

    const animate = (timestamp: number) => {
      if (!previousTimestamp) {
        previousTimestamp = timestamp;
      }

      const deltaSeconds = (timestamp - previousTimestamp) / 1000;
      previousTimestamp = timestamp;

      if (!lastRippleAt || timestamp - lastRippleAt >= RIPPLE_INTERVAL_MS) {
        spawnRipple(timestamp);
      }

      ripples = ripples.filter((ripple) => timestamp - ripple.startedAt < RIPPLE_DURATION_MS);
      const rippleLayers = ripples.flatMap((ripple) => rippleMaskLayers(ripple, timestamp));

      const maskLayers = particles.map((particle) => {
        particle.y += particle.speed * deltaSeconds;
        particle.x += particle.drift * deltaSeconds;

        if (particle.y - particle.radius > sceneHeight) {
          Object.assign(particle, createPixel());
        }

        if (particle.x < -particle.radius) {
          particle.x = sceneWidth + particle.radius;
        } else if (particle.x > sceneWidth + particle.radius) {
          particle.x = -particle.radius;
        }

        return `radial-gradient(circle ${particle.radius}px at ${particle.x}px ${particle.y}px, black 0%, transparent 100%)`;
      });

      const maskValue = [...rippleLayers, ...maskLayers].join(', ');
      gridOverlay.style.setProperty('--grid-mask', maskValue);
      animationFrameId = window.requestAnimationFrame(animate);
    };

    window.addEventListener('resize', updateScene);
    animationFrameId = window.requestAnimationFrame(animate);

    return () => {
      setIsTouchHeroAnimating(false);
      window.removeEventListener('resize', updateScene);
      gridOverlay.style.removeProperty('--grid-size');
      gridOverlay.style.removeProperty('--grid-mask');

      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }

      if (coordinatesRef.current) {
        coordinatesRef.current.textContent = 'X: -- Y: --';
      }
    };
  }, []);

  useEffect(() => {
    if (isCarouselHovering) {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let animationFrameId = 0;
    let previousTimestamp = 0;

    const animate = (timestamp: number) => {
      if (!previousTimestamp) {
        previousTimestamp = timestamp;
      }

      const deltaSeconds = (timestamp - previousTimestamp) / 1000;
      previousTimestamp = timestamp;

      applyTrackOffset(trackOffsetRef.current + CAROUSEL_SPEED_PX_PER_SECOND * deltaSeconds);
      animationFrameId = window.requestAnimationFrame(animate);
    };

    animationFrameId = window.requestAnimationFrame(animate);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [isCarouselHovering]);

  useEffect(() => {
    applyTrackOffset(-pages.length * CAROUSEL_ITEM_WIDTH);
  }, []);

  useEffect(() => {
    let fadeTimeoutId = 0;

    const intervalId = window.setInterval(() => {
      setIsQuoteFading(true);

      fadeTimeoutId = window.setTimeout(() => {
        setQuoteIndex((current) => pickRandomQuoteIndex(current));
        setIsQuoteFading(false);
      }, QUOTE_FADE_MS);
    }, QUOTE_ROTATION_MS);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(fadeTimeoutId);
    };
  }, []);

  const quote = aiRiskQuotes[quoteIndex];

  const handleHeroPointerLeave = () => {
    setIsHovering(false);

    if (coordinatesRef.current) {
      coordinatesRef.current.textContent = 'X: -- Y: --';
    }
  };

  return (
    <div className="app-container">
      <section 
        ref={heroRef}
        className={`hero ${isHovering || isTouchHeroAnimating ? 'is-hovering' : ''}`}
        onPointerEnter={() => setIsHovering(true)}
        onPointerLeave={handleHeroPointerLeave}
      >
        <div className="grid-overlay" ref={gridOverlayRef} />
        
        <div className="tech-details top-left">SYS.01 // READY</div>
        <div className="tech-details top-right" ref={coordinatesRef}>X: -- Y: --</div>
        <div className="tech-details bottom-left">J.ROLSHAUSEN</div>
        <div className="tech-details bottom-right">V 1.0.0</div>

        <div className={`hero-content hero-quote ${isQuoteFading ? 'is-fading' : ''}`}>
          <h1 className="hero-quote-text">
            <span aria-hidden="true">“</span>
            {quote.text}
            <span aria-hidden="true">”</span>
          </h1>
          <p className="hero-quote-author" title={`${quote.role} — ${quote.source}`}>
            — {quote.author}, {quote.year}
          </p>
        </div>

        <div
          className={`hero-carousel ${isCarouselHovering ? 'is-hovered' : ''}`}
          onMouseEnter={() => setIsCarouselHovering(true)}
          onMouseLeave={() => setIsCarouselHovering(false)}
        >
          <button
            className="carousel-arrow"
            type="button"
            onClick={goToPrevSlide}
            aria-label="Vorherige Seite"
          >
            ←
          </button>

          <div className="carousel-window">
            <div
              className="carousel-track"
              ref={carouselTrackRef}
            >
              {carouselPages.map((page, index) => (
                <div className="carousel-slide" key={`${page.name}-${index}`}>
                  {page.path ? (
                    <Link to={page.path} className="carousel-item">
                      {page.name}
                    </Link>
                  ) : (
                    <span className="carousel-item is-mock">{page.name}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            className="carousel-arrow"
            type="button"
            onClick={goToNextSlide}
            aria-label="Nächste Seite"
          >
            →
          </button>
        </div>
      </section>

      <section className="showreel-teaser">
        <div className="teaser-content">
          <div className="teaser-text">
            <h2 className="tech-font">Acting // Showreel</h2>
            <p>Watch my latest performances in an interactive bento experience.</p>
          </div>
          <Link to="/showreel" className="brutal-button">
            Explore Showreel <span className="arrow">→</span>
          </Link>
        </div>
      </section>

      <section className="about">
        <div className="about-content">
          <div className="about-text">
            <h2>About</h2>
            <p>
              Hi, I'm Johannes. Founder, actor, and computer scientist. If you want to get to know me, scroll down a little and connect!
            </p>
            <p>
              This is my digital playground on which I will share random thoughts as well as ideas and digital experiments.
            </p>
          </div>
          <div className="about-image-block">
            <div className="image-container">
              <img
                src={profileImg}
                alt="Johannes Rolshausen"
                className="profile-image"
                loading="lazy"
                decoding="async"
              />
            </div>
            <p className="photo-credit">
              Photo by{' '}
              <a
                href="https://maxiwert.myportfolio.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="photo-credit-link"
              >
                Max Iwert
              </a>
            </p>
          </div>
        </div>
      </section>
      <section className="contact">
        <div className="contact-content">
          <h2>Connect</h2>
          <div className="links-container">
            <a href="https://www.linkedin.com/in/jo-ro/" target="_blank" rel="noopener noreferrer" className="brutal-link">
              <span className="link-label">LINKEDIN</span>
              <span className="link-arrow">↗</span>
            </a>
            <a href="mailto:johannes.rolshausen@gmail.com" className="brutal-link">
              <span className="link-label">EMAIL</span>
              <span className="link-arrow">↗</span>
            </a>
            <a href="https://www.imdb.com/de/name/nm18293583/" target="_blank" rel="noopener noreferrer" className="brutal-link">
              <span className="link-label">IMDB</span>
              <span className="link-arrow">↗</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
