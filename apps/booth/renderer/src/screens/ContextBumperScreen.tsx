import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { navigateToAdmin } from '../lib/navigation';

type Flavor = 'pink' | 'lime';

interface ThemePalette {
  inner: string;
  mid: string;
  outer: string;
}

const THEMES: Record<Flavor, ThemePalette> = {
  pink: { inner: '#ff4bb5', mid: '#7a2b8c', outer: '#1a0b2e' },
  lime: { inner: '#d9f85a', mid: '#5c8f26', outer: '#0a1405' },
};

const SPARKLE_COLORS = ['#ff4bb5', '#ffec5a', '#4acaf1', '#ff7d57', '#a35ef6', '#d9f85a', '#ffffff'];

/* ---- easing / interpolation helpers ---- */
const easePowerIn = (t: number) => t * t;
const easePowerInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeBackOut = (t: number) => {
  const c = 1.5;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

const tweenNumbers = (
  from: number,
  to: number,
  dur: number,
  ease: (t: number) => number,
  onUpdate: (v: number) => void,
  onDone?: () => void,
) => {
  const start = performance.now();
  const tick = (now: number) => {
    let p = (now - start) / (dur * 1000);
    if (p > 1) p = 1;
    const v = from + (to - from) * ease(p);
    onUpdate(v);
    if (p < 1) {
      requestAnimationFrame(tick);
    } else if (onDone) {
      onDone();
    }
  };
  requestAnimationFrame(tick);
};

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const lerpHex = (a: string, b: string, t: number) => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

/* ---- Decorative pieces ---- */
interface BalloonProps {
  className: string;
  color: string;
}

const Balloon: React.FC<BalloonProps> = ({ className, color }) => {
  const dur = 5 + Math.random() * 5;
  const delay = Math.random() * -dur;
  const dx = (Math.random() - 0.5) * 30;
  const dy = 14 + Math.random() * 20;
  const rot = (Math.random() - 0.5) * 20;
  return (
    <div
      className={`pb-balloon ${className}`}
      style={
        {
          '--bcolor': color,
          '--pd': `${dur}s`,
          '--pd-delay': `${delay}s`,
          '--dx': `${dx}px`,
          '--dy': `${dy}px`,
          '--rot': `${rot}deg`,
        } as React.CSSProperties
      }
    >
      <div className="pb-body" />
      <div className="pb-knot" />
      <svg className="pb-string" width="14" height="56" viewBox="0 0 14 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 0 Q2 18 9 34 Q14 46 7 56" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" fill="none" />
      </svg>
    </div>
  );
};

interface CourtProps {
  src: string;
  caption: string;
  className?: string;
}

const Court: React.FC<CourtProps> = ({ src, caption, className }) => (
  <div className={`pb-court ${className ?? ''}`}>
    <img className="pb-photo" src={src} alt={caption} />
    <div className="pb-cap">{caption}</div>
  </div>
);

const photoAsset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

const PHOTOS = [
  photoAsset('photos/1.jpg'),
  photoAsset('photos/2.jpg'),
  photoAsset('photos/3.jpg'),
];

export const ContextBumperScreen: React.FC = () => {
  const confirmPayment = useSessionStore((state) => state.confirmPayment);
  const [theme, setTheme] = useState<Flavor>('pink');
  const [pinOpen, setPinOpen] = useState(false);
  const [pinDigits, setPinDigits] = useState<string[]>([]);
  const [pinError, setPinError] = useState(false);

  const ADMIN_PIN = '250503';

  const rootRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const collageWrapRef = useRef<HTMLDivElement>(null);
  const collageRef = useRef<HTMLDivElement>(null);
  const sparkleRef = useRef<HTMLDivElement>(null);

  const switchingRef = useRef(false);
  const spinRef = useRef(0);
  const themeRef = useRef<Flavor>('pink');
  const mouseRef = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const curMouseRef = useRef({ x: 0, y: 0 });

  /* Load Galada display font */
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Galada&display=swap';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  /* Animation loop: cursor tilt + parallax */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX / window.innerWidth - 0.5;
      mouseRef.current.y = e.clientY / window.innerHeight - 0.5;
      mouseRef.current.px = e.clientX;
      mouseRef.current.py = e.clientY;
    };
    window.addEventListener('mousemove', onMove);

    let rafId = 0;
    const animate = () => {
      const cur = curMouseRef.current;
      const mouse = mouseRef.current;
      cur.x += (mouse.x - cur.x) * 0.05;
      cur.y += (mouse.y - cur.y) * 0.05;

      const collage = collageRef.current;
      if (collage) {
        collage.style.transform = `rotateY(${cur.x * 40 + spinRef.current}deg) rotateX(${-cur.y * 20}deg)`;
      }
      if (bgRef.current) bgRef.current.style.transform = `translate(${cur.x * -30}px, ${cur.y * -30}px)`;
      if (farRef.current) farRef.current.style.transform = `translate(${cur.x * -15}px, ${cur.y * -15}px)`;

      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);

    let interval = 0;
    const cancelFns: Array<() => void> = [];

    const spawnSparkle = () => {
      const box = sparkleRef.current;
      if (!box) return;
      const el = document.createElement('div');
      el.className = 'pb-sparkle';
      const vw = window.innerWidth;
      const scale = vw < 480 ? 0.45 : vw < 1024 ? 0.65 : 1;
      const size = (100 + Math.random() * 14) * scale;
      const dur = 4 + Math.random() * 6;
      const color = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)];
      el.style.cssText = `left: ${Math.random() * 100}%; width: ${size}px; height: ${size}px; --sc: ${color}; animation-duration: ${dur}s;`;
      box.appendChild(el);
      const to = window.setTimeout(() => el.remove(), dur * 1000 + 500);
      cancelFns.push(() => window.clearTimeout(to));
    };
    spawnSparkle();
    interval = window.setInterval(spawnSparkle, 400);

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafId);
      window.clearInterval(interval);
      cancelFns.forEach((fn) => fn());
    };
  }, []);

  const switchFlavor = useCallback((flavor: Flavor) => {
    if (switchingRef.current) return;
    switchingRef.current = true;

    const root = rootRef.current;
    const mainWrap = collageWrapRef.current;
    if (!root) return;

    /* 1. Background morph */
    const from = THEMES[themeRef.current];
    const to = THEMES[flavor];
    tweenNumbers(0, 1, 1.5, easePowerInOut, (p) => {
      root.style.setProperty('--pb-inner', lerpHex(from.inner, to.inner, p));
      root.style.setProperty('--pb-mid', lerpHex(from.mid, to.mid, p));
      root.style.setProperty('--pb-outer', lerpHex(from.outer, to.outer, p));
    });

    /* 2. Collage 720° spin + motion blur, texture swap at peak */
    tweenNumbers(
      0,
      360,
      0.6,
      easePowerIn,
      (v) => {
        spinRef.current = v;
        if (mainWrap) mainWrap.style.filter = `blur(${(v / 360) * 15}px)`;
      },
      () => {
        themeRef.current = flavor;
        setTheme(flavor);

        tweenNumbers(
          360,
          720,
          1.5,
          easeBackOut,
          (v) => {
            spinRef.current = v;
            if (mainWrap) mainWrap.style.filter = `blur(${Math.round(15 * (1 - (v - 360) / 360))}px)`;
          },
          () => {
            spinRef.current = 0;
            if (mainWrap) mainWrap.style.filter = 'none';
            switchingRef.current = false;
          },
        );
      },
    );
  }, []);

  /* Auto theme loop: transition every few seconds, alternating pink <-> lime */
  useEffect(() => {
    let id = 0;
    const kickOff = () => {
      id = window.setInterval(() => {
        if (switchingRef.current) return;
        const next: Flavor = themeRef.current === 'pink' ? 'lime' : 'pink';
        switchFlavor(next);
      }, 7000);
    };
    const first = window.setTimeout(() => {
      if (!switchingRef.current) {
        switchFlavor(themeRef.current === 'pink' ? 'lime' : 'pink');
      }
      kickOff();
    }, 2000);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [switchFlavor]);

  /* PIN-gated camera settings: click the gear, type 111111, and only then
     navigate to #/admin/camera. Wrong PINs clear and flash an error. */
  const closePin = () => {
    setPinOpen(false);
    setPinDigits([]);
    setPinError(false);
  };

  const handlePinKey = (digit: string) => {
    if (pinOpen && pinDigits.length < 6) {
      setPinError(false);
      setPinDigits((prev) => [...prev, digit]);
    }
  };

  const handlePinBackspace = () => {
    setPinError(false);
    setPinDigits((prev) => prev.slice(0, -1));
  };

  const handlePinSubmit = () => {
    if (pinDigits.join('') === ADMIN_PIN) {
      navigateToAdmin('camera');
      closePin();
    } else {
      setPinError(true);
      setPinDigits([]);
    }
  };

  // Submit automatically once the 6th digit is entered.
  useEffect(() => {
    if (pinDigits.length === 6) {
      handlePinSubmit();
    }
  }, [pinDigits]);

  const { inner, mid, outer } = THEMES.pink;

  return (
    <div
      ref={rootRef}
      onClick={confirmPayment}
      className={`pb-screen fixed inset-0 z-[60] select-none cursor-pointer ${theme === 'lime' ? 'pb-lime' : ''}`}
      style={
        {
          '--pb-inner': inner,
          '--pb-mid': mid,
          '--pb-outer': outer,
          background: 'radial-gradient(circle at center, var(--pb-inner) 0%, var(--pb-mid) 50%, var(--pb-outer) 100%)',
        } as React.CSSProperties
      }
    >
      {/* Header */}
      <header className="sticky top-0 z-[120] flex items-center justify-center bg-[#1a0b2e]/30 px-[4%] py-4 backdrop-blur-md md:absolute md:inset-x-0 md:bg-transparent md:py-8 md:backdrop-blur-none">
        <div className="flex items-center gap-2 text-lg md:text-xl" style={{ fontFamily: "'Galada', cursive" }}>
          <h2
            className="text-5xl leading-[0.8] text-white sm:text-6xl lg:text-7xl"
            style={{ fontFamily: "'Galada', cursive", animation: 'pb-fade 0.7s ease-out 0.6s both' }}
          >
            <span className="text-transparent" style={{ WebkitTextStroke: '1.5px rgba(255,255,255,0.9)' }}>Photostrip</span>
          </h2>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPinOpen(true);
          }}
          title="Booth Setup"
          aria-label="Booth Setup"
          className="absolute right-[4%] top-1/2 -translate-y-1/2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 border-white/30 bg-white/10 text-xl text-white backdrop-blur transition-transform hover:scale-110 hover:bg-white/25"
        >
          ⚙️
        </button>
      </header>

      {/* Far background balloons */}
      <div ref={farRef} className="pb-layer" style={{ zIndex: -1 }}>
        <Balloon className="l1" color="#ffec5a" />
        <Balloon className="l2" color="#a35ef6" />
        <Balloon className="l3" color="#4acaf1" />
        <Balloon className="l4" color="#ff4bb5" />
      </div>

      {/* Background balloons (behind the collage) */}
      <div ref={bgRef} className="pb-layer" style={{ zIndex: 0 }}>
        <Balloon className="b7" color="#ff7d57" />
        <Balloon className="b8" color="#a35ef6" />
        <Balloon className="b9" color="#ff4bb5" />
      </div>

      {/* Center product: 3D photo collage (horizontal on landscape, vertical on portrait) */}
      <div className="pb-hero-center">
        <div ref={collageWrapRef} className="pb-main">
          <div ref={collageRef} className="pb-collage">
            <Court src={PHOTOS[0]} caption="The Best" className="court-1" />
            <Court src={PHOTOS[1]} caption="Photostrip" className="court-2" />
            <Court src={PHOTOS[2]} caption="Experience" className="court-3" />
          </div>
        </div>
      </div>

      {/* Rising sparkles */}
      <div ref={sparkleRef} className="pointer-events-none absolute inset-0 z-[5]" />

      {/* Tap-to-start instruction */}
      <div className="absolute inset-x-0 bottom-0 z-[110] flex justify-center pb-10">
        <p
          className="flex items-center gap-3 text-2xl tracking-wide text-white md:text-3xl"
          style={{ fontFamily: "'Galada', cursive", animation: 'pb-bounce-in 1.4s ease 1s both, pb-glow 2.4s ease-in-out 2s infinite' }}
        >
          <span className="inline-block" style={{ animation: 'pb-tap 1.2s ease-in-out infinite' }}>👆</span>
          Click dimana saja untuk mulai
        </p>
      </div>

      {/* Admin PIN modal — gate to camera settings */}
      {pinOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[#1a0b2e]/80 p-4"
          onClick={(e) => {
            e.stopPropagation();
            closePin();
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Admin PIN"
            className="w-full max-w-xs rounded-[24px] border-4 border-[#ff4bb5] bg-[#fdf3ff] p-6 text-center shadow-2xl"
          >
            <h3 className="text-[0.9rem] font-black uppercase tracking-[0.14em] text-[#4d2d85]">Admin PIN</h3>
            <p className="mt-1 text-[0.7rem] font-bold tracking-wide text-[#6d6a7f]">
              Masukkan PIN untuk membuka setting kamera
            </p>

            {/* PIN dots */}
            <div className="mt-5 flex items-center justify-center gap-3">
              {Array.from({ length: 6 }, (_, i) => (
                <span
                  key={i}
                  className={`h-4 w-4 rounded-full border-2 ${
                    pinDigits[i]
                      ? pinError
                        ? 'border-[#b0003a] bg-[#b0003a]'
                        : 'border-[#ff4bb5] bg-[#ff4bb5]'
                      : 'border-[#a35ef6] bg-white'
                  }`}
                />
              ))}
            </div>
            {pinError && (
              <p className="mt-2 text-[0.7rem] font-black uppercase tracking-[0.1em] text-[#b0003a]">
                PIN salah — coba lagi
              </p>
            )}

            {/* Numpad */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handlePinKey(digit)}
                  className="rounded-[14px] border-[3px] border-[#a35ef6] bg-white py-3 text-xl font-black text-[#4d2d85] shadow-[0_3px_0_rgba(77,45,133,0.2)] active:translate-y-0.5"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handlePinBackspace}
                aria-label="Delete digit"
                className="rounded-[14px] border-[3px] border-[#a35ef6] bg-white py-3 text-xl font-black text-[#4d2d85] shadow-[0_3px_0_rgba(77,45,133,0.2)] active:translate-y-0.5"
              >
                ⌫
              </button>
              <button
                type="button"
                onClick={() => handlePinKey('0')}
                className="rounded-[14px] border-[3px] border-[#a35ef6] bg-white py-3 text-xl font-black text-[#4d2d85] shadow-[0_3px_0_rgba(77,45,133,0.2)] active:translate-y-0.5"
              >
                0
              </button>
              <button
                type="button"
                onClick={closePin}
                aria-label="Close"
                className="rounded-[14px] border-[3px] border-[#b0003a] bg-[#ff4bb5] py-3 text-xl font-black text-white shadow-[0_3px_0_rgba(0,0,0,0.2)] active:translate-y-0.5"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContextBumperScreen;