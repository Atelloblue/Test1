import { useEffect, useRef, useState, useCallback } from 'react';
import { WindWorld } from './world/WindWorld';
import { MobileControls } from './components/MobileControls';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<WindWorld | null>(null);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [needsClick, setNeedsClick] = useState(true);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    setIsMobileDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    if (!started) return;
    const handleClick = () => setNeedsClick(false);
    window.addEventListener('click', handleClick);
    window.addEventListener('touchstart', handleClick);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('touchstart', handleClick);
    };
  }, [started]);

  useEffect(() => {
    if (!started || !containerRef.current) return;

    setLoading(true);
    const world = new WindWorld(containerRef.current, () => {
      setLoading(false);
    });
    worldRef.current = world;

    const timer = setTimeout(() => setShowHint(false), 8000);

    return () => {
      clearTimeout(timer);
      world.dispose();
    };
  }, [started]);

  // Mobile control callbacks
  const handleMove = useCallback((x: number, y: number) => {
    worldRef.current?.setMobileMove(x, y);
  }, []);

  const handleLook = useCallback((dx: number, dy: number) => {
    worldRef.current?.setMobileLook(dx, dy);
  }, []);

  const handleAction = useCallback((action: 'rise' | 'glide' | null) => {
    worldRef.current?.setMobileAction(action);
  }, []);

  if (!started) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#1a2a3a] to-[#0a1520] overflow-hidden relative">
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white/10 animate-pulse"
              style={{
                width: `${Math.random() * 4 + 2}px`,
                height: `${Math.random() * 4 + 2}px`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${Math.random() * 3 + 2}s`,
              }}
            />
          ))}
        </div>

        <div className="text-center z-10 px-6">
          <h1 className="text-5xl md:text-8xl font-thin text-white/90 mb-4 tracking-wider">
            Wind Whispers
          </h1>
          <p className="text-lg md:text-2xl text-white/50 font-light mb-12 tracking-wide">
            A calming exploration experience
          </p>
          <button
            onClick={() => setStarted(true)}
            className="px-12 py-4 bg-white/10 hover:bg-white/20 border border-white/20 
                       rounded-full text-white/80 text-lg tracking-widest transition-all duration-500
                       hover:scale-105 hover:shadow-lg hover:shadow-white/10 backdrop-blur-sm"
          >
            Begin Journey
          </button>
          <p className="mt-8 text-white/30 text-sm">
            🎧 Headphones recommended for the best experience
          </p>
        </div>

        {/* Decorative wind lines */}
        <svg className="absolute bottom-0 left-0 w-full h-32 opacity-20" viewBox="0 0 1200 120">
          <path d="M0,60 Q300,20 600,60 T1200,60" fill="none" stroke="white" strokeWidth="0.5" className="animate-pulse" />
          <path d="M0,80 Q300,40 600,80 T1200,80" fill="none" stroke="white" strokeWidth="0.3" className="animate-pulse" style={{ animationDelay: '1s' }} />
          <path d="M0,100 Q300,60 600,100 T1200,100" fill="none" stroke="white" strokeWidth="0.3" className="animate-pulse" style={{ animationDelay: '2s' }} />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen relative overflow-hidden bg-black">
      <div ref={containerRef} className="w-full h-full" />
      
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a1520] z-50">
          <div className="text-center">
            <div className="w-16 h-16 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/60 text-lg tracking-wider">Preparing your journey...</p>
          </div>
        </div>
      )}

      {showHint && !loading && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 
                        bg-black/40 backdrop-blur-md px-6 py-3 rounded-full
                        border border-white/10 animate-fade-in hint-text">
          <p className="text-white/70 text-sm tracking-wide text-center hidden md:block">
            <span className="text-white/90">WASD</span> to move &nbsp;•&nbsp; 
            <span className="text-white/90">Mouse</span> to look &nbsp;•&nbsp; 
            <span className="text-white/90">Shift</span> to glide &nbsp;•&nbsp;
            <span className="text-white/90">Space</span> to rise
          </p>
          <p className="text-white/70 text-xs tracking-wide text-center md:hidden">
            <span className="text-white/90">Left side</span> drag to move &nbsp;•&nbsp; 
            <span className="text-white/90">Right side</span> drag to look &nbsp;•&nbsp;
            <span className="text-white/90">Buttons</span> to rise/glide
          </p>
        </div>
      )}

      {/* Click to look overlay (desktop) */}
      {needsClick && !isMobileDevice && !loading && (
        <div className="absolute inset-0 z-45 flex items-center justify-center 
                        bg-black/30 backdrop-blur-sm cursor-pointer"
             onClick={() => setNeedsClick(false)}>
          <div className="text-center animate-fade-in">
            <div className="w-20 h-20 rounded-full border-2 border-white/30 
                           flex items-center justify-center mx-auto mb-4 animate-glow">
              <svg className="w-8 h-8 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                      d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <p className="text-white/70 text-lg tracking-wider">Click to explore</p>
            <p className="text-white/40 text-sm mt-2">Press ESC to release cursor</p>
          </div>
        </div>
      )}

      {/* Mobile Controls */}
      <MobileControls 
        onMove={handleMove}
        onLook={handleLook}
        onAction={handleAction}
      />

      {/* Ambient overlay with vignette */}
      <div className="absolute inset-0 pointer-events-none z-30"
           style={{
             background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%)',
           }} />
      
      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none z-30 
                      bg-gradient-to-t from-black/15 to-transparent" />
    </div>
  );
}

export default App;
