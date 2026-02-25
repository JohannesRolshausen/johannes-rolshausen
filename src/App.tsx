import { useState, useEffect } from 'react';
import profileImg from './assets/Johannes Rolshausen.JPG';
import './App.css';

function App() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
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
          <h1>Welcome  to  the playground</h1>
          <p>By Johannes Rolshausen</p>
        </div>
      </section>
      <section className="about">
        <div className="about-content">
          <div className="about-text">
            <h2>About</h2>
            <p>
              Hi, I'm Johannes. Founder, actor, and computer scientist. If you want to know more about me, scroll down a little and connect!
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
