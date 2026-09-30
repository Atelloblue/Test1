import { useEffect, useRef, useState } from 'react';

interface MobileControlsProps {
  onMove: (x: number, y: number) => void;
  onLook: (x: number, y: number) => void;
  onAction: (action: 'rise' | 'glide' | null) => void;
}

export function MobileControls({ onMove, onLook, onAction }: MobileControlsProps) {
  const [isMobile, setIsMobile] = useState(false);
  const joystickRef = useRef<HTMLDivElement>(null);
  const joystickKnob = useRef<HTMLDivElement>(null);
  const lookAreaRef = useRef<HTMLDivElement>(null);
  
  const joystickCenter = useRef({ x: 0, y: 0 });
  const joystickTouchId = useRef<number | null>(null);
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef({ x: 0, y: 0 });
  const riseActive = useRef(false);
  const glideActive = useRef(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const x = touch.clientX;
        const y = touch.clientY;
        const screenW = window.innerWidth;

        // Left side = joystick
        if (x < screenW * 0.4 && !joystickTouchId.current) {
          joystickTouchId.current = touch.identifier;
          joystickCenter.current = { x, y };
          if (joystickRef.current) {
            joystickRef.current.style.left = `${x - 60}px`;
            joystickRef.current.style.top = `${y - 60}px`;
            joystickRef.current.style.opacity = '1';
          }
        }
        // Right side = look
        else if (x > screenW * 0.5 && !lookTouchId.current) {
          lookTouchId.current = touch.identifier;
          lastLookPos.current = { x, y };
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        // Joystick movement
        if (touch.identifier === joystickTouchId.current) {
          const dx = touch.clientX - joystickCenter.current.x;
          const dy = touch.clientY - joystickCenter.current.y;
          const maxDist = 50;
          const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDist);
          const angle = Math.atan2(dy, dx);
          
          const normX = (dist / maxDist) * Math.cos(angle);
          const normY = (dist / maxDist) * Math.sin(angle);
          
          if (joystickKnob.current) {
            joystickKnob.current.style.transform = `translate(${normX * 40}px, ${normY * 40}px)`;
          }
          
          onMove(normX, -normY); // Invert Y for forward movement
        }

        // Look/drag
        if (touch.identifier === lookTouchId.current) {
          const dx = touch.clientX - lastLookPos.current.x;
          const dy = touch.clientY - lastLookPos.current.y;
          lastLookPos.current = { x: touch.clientX, y: touch.clientY };
          onLook(dx, dy);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        if (touch.identifier === joystickTouchId.current) {
          joystickTouchId.current = null;
          if (joystickKnob.current) {
            joystickKnob.current.style.transform = 'translate(0, 0)';
          }
          if (joystickRef.current) {
            joystickRef.current.style.opacity = '0';
          }
          onMove(0, 0);
        }

        if (touch.identifier === lookTouchId.current) {
          lookTouchId.current = null;
          onLook(0, 0);
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isMobile, onMove, onLook]);

  if (!isMobile) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {/* Virtual Joystick */}
      <div
        ref={joystickRef}
        className="absolute w-[120px] h-[120px] rounded-full border-2 border-white/20 
                   bg-white/5 backdrop-blur-sm opacity-0 transition-opacity duration-300"
        style={{ left: '20%', top: '60%', transform: 'translate(-50%, -50%)' }}
      >
        <div
          ref={joystickKnob}
          className="absolute w-12 h-12 rounded-full bg-white/30 border border-white/40
                     top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     transition-transform duration-75"
        />
      </div>

      {/* Action Buttons */}
      <div className="absolute right-6 bottom-24 flex flex-col gap-3 pointer-events-auto">
        <button
          className="w-16 h-16 rounded-full bg-white/10 border border-white/20 
                     backdrop-blur-sm flex items-center justify-center
                     active:bg-white/30 transition-colors"
          onTouchStart={() => { riseActive.current = true; onAction('rise'); }}
          onTouchEnd={() => { riseActive.current = false; onAction(null); }}
        >
          <span className="text-white/70 text-2xl">↑</span>
        </button>
        <button
          className="w-16 h-16 rounded-full bg-white/10 border border-white/20 
                     backdrop-blur-sm flex items-center justify-center
                     active:bg-white/30 transition-colors"
          onTouchStart={() => { glideActive.current = true; onAction('glide'); }}
          onTouchEnd={() => { glideActive.current = false; onAction(null); }}
        >
          <span className="text-white/70 text-xs font-bold">GLIDE</span>
        </button>
      </div>

      {/* Look area indicator */}
      <div className="absolute right-0 top-0 w-1/2 h-full pointer-events-none">
        <div className="absolute top-8 right-8 text-white/30 text-xs">
          Drag to look
        </div>
      </div>

      {/* Left side indicator */}
      <div className="absolute left-4 top-8 text-white/30 text-xs pointer-events-none">
        Touch & drag to move
      </div>
    </div>
  );
}
