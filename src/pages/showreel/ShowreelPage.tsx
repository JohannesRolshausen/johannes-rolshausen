import { useEffect, useRef, useState } from 'react';
import './ShowreelPage.css';

type ShowreelClip = {
  id: string;
  title: string;
  role?: string;
  src: string;
  poster?: string;
  span: 'big' | 'wideH' | 'wideFull' | 'tallV' | 'unit';
  noSound?: boolean;
};

const CLIPS: ShowreelClip[] = [
    {
    id: '2',
    title: 'Two Sides',
    src: '/Two Sides.mp4',
    span: 'wideFull',
  },
  {
    id: '1',
    title: 'Fatal',
    src: '/fatal.mp4',
    span: 'wideH',
    noSound: true,
  },
  {
    id: '3',
    title: 'Victim',
    src: '/victim.mp4',
    span: 'wideH',
  },
  {
    id: '4',
    title: 'Meisner Technique Scene',
    src: '/Meisner.PNG',
    span: 'tallV',
  },
  {
    id: '5',
    title: 'The Visit',
    src: '/Besuch.jpg',
    span: 'wideH',
  },
];

function isImageClip(clip: ShowreelClip) {
  return /\.(png|jpe?g|gif|webp|avif)$/i.test(clip.src);
}

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
  const [activeId, setActiveId] = useState<string | null>(null);
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
          
          const clip = CLIPS.find((c) => c.id === id);
          if (clip && !isImageClip(clip)) {
            const video = videoRefs.current.get(`mobile-${id}`);
            if (video) {
              video.play().catch(() => {});
            }
          }
        } else {
          const id = entry.target.getAttribute('data-id');
          const clip = CLIPS.find((c) => c.id === id);
          if (clip && !isImageClip(clip)) {
            const video = videoRefs.current.get(`mobile-${id}`);
            if (video) {
              video.pause();
            }
          }
        }
      });
    }, options);

    const items = carouselRef.current?.querySelectorAll('.bento-item');
    items?.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, []);

  const handleItemClick = (clip: ShowreelClip) => {
    const isActive = activeId === clip.id;

    if (isActive) {
      setActiveId(null);
      if (!isImageClip(clip)) {
        const video = videoRefs.current.get(`desktop-${clip.id}`);
        if (video) {
          video.pause();
        }
      }
      return;
    }

    if (activeId) {
      const prevClip = CLIPS.find((c) => c.id === activeId);
      if (prevClip && !isImageClip(prevClip)) {
        const prevVideo = videoRefs.current.get(`desktop-${activeId}`);
        if (prevVideo) {
          prevVideo.pause();
        }
      }
    }

    setActiveId(clip.id);

    if (!isImageClip(clip)) {
      const video = videoRefs.current.get(`desktop-${clip.id}`);
      if (video) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
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
            const isActive = activeId === clip.id;
            const isDimmed = activeId !== null && !isActive;
            const isImage = isImageClip(clip);
            const showSound = !isImage && !clip.noSound;

            return (
              <div
                key={clip.id}
                className={`bento-item ${clip.span} ${isActive ? 'is-active' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
                onClick={() => handleItemClick(clip)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleItemClick(clip);
                  }
                }}
                aria-pressed={isActive}
              >
                <div className="video-container">
                  {isImage ? (
                    <img src={clip.src} alt={clip.title} />
                  ) : (
                    <video
                      ref={(el) => {
                        if (el) videoRefs.current.set(`desktop-${clip.id}`, el);
                      }}
                      src={clip.src}
                      poster={clip.poster}
                      muted={!soundOn}
                      playsInline
                      loop
                      preload="auto"
                    />
                  )}
                  <div className="clip-overlay">
                    <div className="clip-info">
                      <span className="clip-title">{clip.title}</span>
                      {clip.role && <span className="clip-role">{clip.role}</span>}
                    </div>
                    {showSound && (
                      <button
                        type="button"
                        className={`sound-toggle ${soundOn ? 'is-on' : ''}`}
                        onClick={toggleSound}
                        aria-label={soundOn ? 'Mute' : 'Unmute'}
                      >
                        <SoundIcon on={soundOn} />
                      </button>
                    )}
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
            {CLIPS.map((clip) => {
              const isImage = isImageClip(clip);
              const showSound = !isImage && !clip.noSound;

              return (
                <div
                  key={clip.id}
                  data-id={clip.id}
                  className={`bento-item unit ${activeMobileId === clip.id ? 'is-active' : ''}`}
                >
                  <div className="video-container">
                    {isImage ? (
                      <img src={clip.src} alt={clip.title} />
                    ) : (
                      <video
                        ref={(el) => {
                          if (el) videoRefs.current.set(`mobile-${clip.id}`, el);
                        }}
                        src={clip.src}
                        poster={clip.poster}
                        muted={!soundOn}
                        playsInline
                        loop
                        preload="auto"
                      />
                    )}
                    <div className="clip-overlay">
                      <div className="clip-info">
                        <span className="clip-title">{clip.title}</span>
                        {clip.role && <span className="clip-role">{clip.role}</span>}
                      </div>
                      {showSound && (
                        <button
                          type="button"
                          className={`sound-toggle ${soundOn ? 'is-on' : ''}`}
                          onClick={toggleSound}
                          aria-label={soundOn ? 'Mute' : 'Unmute'}
                        >
                          <SoundIcon on={soundOn} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="carousel-edge carousel-edge--right" aria-hidden="true" />
        </div>
      </main>
    </div>
  );
}
