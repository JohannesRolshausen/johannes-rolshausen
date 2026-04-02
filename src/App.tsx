import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import profileImg from './assets/Johannes-Rolshausen.jpg';
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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isCarouselHovering, setIsCarouselHovering] = useState(false);
  const [trackOffset, setTrackOffset] = useState(-pages.length * CAROUSEL_ITEM_WIDTH);

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

  const goToNextSlide = () => {
    setTrackOffset((prev) => normalizeOffset(prev - CAROUSEL_ITEM_WIDTH));
  };

  const goToPrevSlide = () => {
    setTrackOffset((prev) => normalizeOffset(prev + CAROUSEL_ITEM_WIDTH));
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    if (isCarouselHovering) {
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

      setTrackOffset((prev) => normalizeOffset(prev + CAROUSEL_SPEED_PX_PER_SECOND * deltaSeconds));
      animationFrameId = window.requestAnimationFrame(animate);
    };

    animationFrameId = window.requestAnimationFrame(animate);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [isCarouselHovering]);

  useEffect(() => {
    setTrackOffset(-pages.length * CAROUSEL_ITEM_WIDTH);
  }, []);

  return (
    <div className="app-container">
      <section 
        className="hero"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div 
          className="grid-overlay"
          style={{
            maskImage: isHovering ? `radial-gradient(circle 300px at ${mousePos.x}px ${mousePos.y}px, black 0%, transparent 100%)` : 'none',
            WebkitMaskImage: isHovering ? `radial-gradient(circle 300px at ${mousePos.x}px ${mousePos.y}px, black 0%, transparent 100%)` : 'none',
            opacity: isHovering ? 1 : 0,
            transition: 'opacity 0.4s ease'
          }}
        />
        
        <div className="tech-details top-left">SYS.01 // READY</div>
        <div className="tech-details top-right">X: {mousePos.x} Y: {mousePos.y}</div>
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
              style={{ transform: `translateX(${trackOffset}px)` }}
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
            <img src={profileImg} alt="Johannes Rolshausen" className="profile-image" />
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
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
