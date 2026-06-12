import { useEffect, useRef, useState } from 'react';
import './ShowreelPage.css';

type ShowreelClip = {
  id: string;
  title: string;
  role?: string;
  src: string;
  poster?: string;
  span: 'big' | 'wideH' | 'tallV' | 'unit';
};

const CLIPS: ShowreelClip[] = [
  {
    id: '1',
    title: 'Lead Role - Action Thriller',
    role: 'Detective Miller',
    src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    span: 'big',
  },
  {
    id: '2',
    title: 'Dramatic Monologue',
    role: 'The Stranger',
    src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    span: 'wideH',
  },
  {
    id: '3',
    title: 'Comedy Sketch',
    role: 'Office Worker',
    src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    span: 'tallV',
  },
  {
    id: '4',
    title: 'Commercial Work',
    role: 'Tech Enthusiast',
    src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    span: 'unit',
  },
  {
    id: '5',
    title: 'Short Film - Sci-Fi',
    role: 'Android 7',
    src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    span: 'unit',
  },
  {
    id: '6',
    title: 'Period Drama',
    role: 'Lord Byron',
    src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    span: 'unit',
  },
];

function SoundIcon({ on }: { on: boolean }) {
  if (on) {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M11 5 6 9H2v6h4l5 4V5z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="m22 9-6 6M16 9l6 6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export default function ShowreelPage() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [activeMobileId, setActiveMobileId] = useState<string | null>(CLIPS[0]?.id ?? null);
  
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const carouselRef = useRef<HTMLDivElement>(null);

  // Handle global sound toggle
  useEffect(() => {
    videoRefs.current.forEach((video) => {
      video.muted = !soundOn;
    });
  }, [soundOn]);

  // Mobile Intersection Observer
  useEffect(() => {
    const options = {
      root: carouselRef.current,
      threshold: 0.6,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('data-id');
          setActiveMobileId(id);
          
          const video = videoRefs.current.get(id!);
          if (video) {
            video.play().catch(() => {}); // Autoplay might be blocked
          }
        } else {
          const id = entry.target.getAttribute('data-id');
          const video = videoRefs.current.get(id!);
          if (video) {
            video.pause();
          }
        }
      });
    }, options);

    const items = carouselRef.current?.querySelectorAll('.bento-item');
    items?.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, []);

  const handleMouseEnter = (id: string) => {
    setHoveredId(id);
    const video = videoRefs.current.get(id);
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  };

  const handleMouseLeave = (id: string) => {
    setHoveredId(null);
    const video = videoRefs.current.get(id);
    if (video) {
      video.pause();
    }
  };

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSoundOn(!soundOn);
  };

  return (
    <div className="showreel-page">
      <header className="showreel-header">
        <div className="header-title">
          <h1>Acting | Showreel</h1>
          <p className="tech-font">J. Rolshausen // Performance Archive</p>
        </div>
        <div className="header-actions">
          <a href="/" className="home-link">
            Back Home
          </a>
        </div>
      </header>

      <main className="showreel-content">
        {/* Desktop Bento Grid */}
        <div className="bento-grid desktop-only">
          {CLIPS.map((clip) => {
            const isActive = hoveredId === clip.id;
            const isDimmed = hoveredId !== null && !isActive;

            return (
              <div
                key={clip.id}
                className={`bento-item ${clip.span} ${isActive ? 'is-active' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
                onMouseEnter={() => handleMouseEnter(clip.id)}
                onMouseLeave={() => handleMouseLeave(clip.id)}
              >
                <div className="video-container">
                  <video
                    ref={(el) => {
                      if (el) videoRefs.current.set(clip.id, el);
                    }}
                    src={clip.src}
                    poster={clip.poster}
                    muted={!soundOn}
                    playsInline
                    loop
                    preload="metadata"
                  />
                  <div className="clip-overlay">
                    <div className="clip-info">
                      <span className="clip-title">{clip.title}</span>
                      {clip.role && <span className="clip-role">{clip.role}</span>}
                    </div>
                    <button
                      type="button"
                      className={`sound-toggle ${soundOn ? 'is-on' : ''}`}
                      onClick={toggleSound}
                      aria-label={soundOn ? 'Mute' : 'Unmute'}
                    >
                      <SoundIcon on={soundOn} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile Carousel */}
        <div className="mobile-only carousel-shell">
          <div className="carousel-edge carousel-edge--left" aria-hidden="true" />
          <div className="bento-carousel" ref={carouselRef}>
            {CLIPS.map((clip) => (
              <div
                key={clip.id}
                data-id={clip.id}
                className={`bento-item unit ${activeMobileId === clip.id ? 'is-active' : ''}`}
              >
                <div className="video-container">
                  <video
                    ref={(el) => {
                      if (el) videoRefs.current.set(clip.id, el);
                    }}
                    src={clip.src}
                    poster={clip.poster}
                    muted={!soundOn}
                    playsInline
                    loop
                    preload="metadata"
                  />
                  <div className="clip-overlay">
                    <div className="clip-info">
                      <span className="clip-title">{clip.title}</span>
                      {clip.role && <span className="clip-role">{clip.role}</span>}
                    </div>
                    <button
                      type="button"
                      className={`sound-toggle ${soundOn ? 'is-on' : ''}`}
                      onClick={toggleSound}
                      aria-label={soundOn ? 'Mute' : 'Unmute'}
                    >
                      <SoundIcon on={soundOn} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="carousel-edge carousel-edge--right" aria-hidden="true" />
        </div>
      </main>
    </div>
  );
}
