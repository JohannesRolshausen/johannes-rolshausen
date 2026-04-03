import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import profileImg from './assets/Johannes-Rolshausen.webp';
import './App.css';

const pages = [
  { name: 'Sound Canvas', path: '/soundCanvas' },
  { name: 'AI that never hallucinates', path: '/neverHallucinateAI' },
  //{ name: 'Analog Thoughts', path: undefined },
  //{ name: 'Motion Stories', path: undefined },
  //{ name: 'Playground Lab Notes', path: undefined },
];

const CAROUSEL_ITEM_WIDTH = 320;
const CAROUSEL_SPEED_PX_PER_SECOND = 48;

function App() {
  const [isHovering, setIsHovering] = useState(false);
  const [isCarouselHovering, setIsCarouselHovering] = useState(false);
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
        className={`hero ${isHovering ? 'is-hovering' : ''}`}
        onPointerEnter={() => setIsHovering(true)}
        onPointerLeave={handleHeroPointerLeave}
      >
        <div className="grid-overlay" ref={gridOverlayRef} />
        
        <div className="tech-details top-left">SYS.01 // READY</div>
        <div className="tech-details top-right" ref={coordinatesRef}>X: -- Y: --</div>
        <div className="tech-details bottom-left">J.ROLSHAUSEN</div>
        <div className="tech-details bottom-right">V 1.0.0</div>

        <div className="hero-content">
          <h1 style={{ marginLeft: '4px', marginRight: '4px' }}>Welcome  to  my  playground</h1>
          <p>By Johannes Rolshausen</p>
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
          <div className="image-container">
            <img
              src={profileImg}
              alt="Johannes Rolshausen"
              className="profile-image"
              loading="lazy"
              decoding="async"
            />
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
