import { useEffect, useRef, useState } from 'react';
import { WindWorld } from './world/WindWorld';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<WindWorld | null>(null);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showHint, setShowHint] = useState(true);

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

  if (!started) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#1a2a3a] to-[#0a1520] overflow-hidden relative">
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
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
          <h1 className="text-6xl md:text-8xl font-thin text-white/90 mb-4 tracking-wider">
            Wind Whispers
          </h1>
          <p className="text-xl md:text-2xl text-white/50 font-light mb-12 tracking-wide">
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
                        bg-black/40 backdrop-blur-md px-8 py-4 rounded-full
                        border border-white/10 animate-fade-in">
          <p className="text-white/70 text-sm tracking-wide text-center">
            <span className="text-white/90">WASD</span> to move &nbsp;•&nbsp; 
            <span className="text-white/90">Mouse</span> to look &nbsp;•&nbsp; 
            <span className="text-white/90">Shift</span> to glide &nbsp;•&nbsp;
            <span className="text-white/90">Space</span> to rise
          </p>
        </div>
      )}

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
