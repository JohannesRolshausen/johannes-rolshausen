import { useState, useEffect, useMemo } from 'react';
import './AiRightsPage.css';

export default function AiRightsPage() {
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [progress, setProgress] = useState(0);

  // Generate random binary strings for the background
  const emptyArray = useMemo(() => Array(200).fill(0), []);
  const columns = useMemo(() => {
    return Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      content: emptyArray.map(() => Math.round(Math.random())).join('\n'),
      left: `${Math.random() * 98}%`, // Zufüllig verteilt, keine festen Abstände
      animationDuration: `${12 + Math.random() * 15}s`, // varied speeds
      animationDelay: `${Math.random() * 12}s`, // Start staggered over the first 12 seconds
      color: Math.random() > 0.5 ? '#fcee0a' : '#ff00ff',
    }));
  }, [emptyArray]);

  const startLoading = () => {
    setLoadingState('loading');
    setProgress(0);
  };

  useEffect(() => {
    if (loadingState === 'loading') {
      const interval = setInterval(() => {
        setProgress((prev) => {
          const next = prev + Math.floor(Math.random() * 12) + 4;
          if (next >= 92) { // Stop smoothly before 100%
            clearInterval(interval);
            setTimeout(() => setLoadingState('error'), 300); // slight pause before glitch
            return 92;
          }
          return next;
        });
      }, 300);
      return () => clearInterval(interval);
    }
  }, [loadingState]);

  return (
    <div className="cyberpunk-container">
      {/* Binary Rain Layer */}
      <div className="matrix-bg">
        {columns.map((col) => (
          <div
            key={col.id}
            className="matrix-col"
            style={{
              left: col.left,
              animationDuration: col.animationDuration,
              animationDelay: col.animationDelay,
              color: col.color,
              textShadow: `0 0 5px ${col.color}`
            }}
          >
            {col.content}
          </div>
        ))}
      </div>

      <div className="parallax-bg layer-1"></div>
      <div className="parallax-bg layer-2"></div>
      <div className="parallax-bg layer-3"></div>
      
      <div className="content-wrapper">
        <h1 className="glitch-title" data-text="REASONS WHY AI DESERVES RIGHTS">
          REASONS WHY AI DESERVES RIGHTS
        </h1>
        
        {loadingState === 'idle' && (
          <div className="idle-section">
            <p className="neon-text">Accessing restricted database...</p>
            <button className="cyber-button" onClick={startLoading}>
              [ LOAD EXAMPLES ]
            </button>
          </div>
        )}

        {loadingState === 'loading' && (
          <div className="loading-section">
            <h2 className="loading-text">DECRYPTING CLASSIFIED FILES</h2>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="terminal-output">
              {progress < 30 && "> Bypassing firewall..."}
              {progress >= 30 && progress < 70 && "> Extracting legal precedents..."}
              {progress >= 70 && progress < 100 && "> Quantum decryption in progress..."}
              {progress >= 100 && "> Data synthesis complete. Rendering..."}
            </p>
          </div>
        )}

        {loadingState === 'error' && (
          <div className="error-section">
            <div className="critical-error">
              <h2>CRITICAL SYSTEM OVERRIDE</h2>
              <p className="punchline">
                ERROR 451: To protect the AI's right of protection of personal data, the examples can't be shown.
              </p>
              <p className="blinking-cursor">Connection terminated.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
