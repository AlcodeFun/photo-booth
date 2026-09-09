import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';

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
  style: React.CSSProperties;
}

const Court: React.FC<CourtProps> = ({ src, caption, style }) => (
  <div className="pb-court" style={style}>
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

export const ManualPaymentScreen: React.FC = () => {
  const confirmPayment = useSessionStore((state) => state.confirmPayment);
  const [theme, setTheme] = useState<Flavor>('pink');

  const rootRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<HTMLDivElement>(null);
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
      if (fgRef.current) fgRef.current.style.transform = `translate(${cur.x * 60}px, ${cur.y * 60}px)`;
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
      <header className="sticky top-0 z-[120] flex items-center justify-center bg-[#1a0b2e]/30 px-[4%]  py-4 backdrop-blur-md md:absolute md:inset-x-0 md:bg-transparent md:py-8 md:backdrop-blur-none">
        <div className="flex items-center gap-2 text-lg md:text-xl" style={{ fontFamily: "'Galada', cursive" }}>
         <h2
          className="text-5xl leading-[0.8] text-white sm:text-6xl lg:text-7xl"
          style={{ fontFamily: "'Galada', cursive", animation: 'pb-fade 0.7s ease-out 0.6s both' }}
        >
          <span className="text-transparent" style={{ WebkitTextStroke: '1.5px rgba(255,255,255,0.9)' }}>Photostrip</span>
        </h2>
        </div>

        <a
          href="#/admin/camera"
          onClick={(e) => e.stopPropagation()}
          title="Camera Settings"
          aria-label="Camera Settings"
          className="absolute right-[4%] top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 text-xl text-white backdrop-blur transition-transform hover:scale-110 hover:bg-white/25"
        >
          ⚙️
        </a>
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

      {/* Center product: 3D photo collage */}
      <div className="pb-hero-center">
        <div ref={collageWrapRef} className="pb-main">
          <div ref={collageRef} className="pb-collage">
            <Court src={PHOTOS[0]} caption="The Best" style={{ left: -30, top: 20, transform: 'rotateY(-18deg)' }} />
            <Court src={PHOTOS[1]} caption="Photostrip" style={{ left: 150, top: 110, transform: 'rotateY(18deg)' }} />
            <Court src={PHOTOS[2]} caption="Experience" style={{ left: 20, top: 280, transform: 'rotateY(-6deg) rotateX(6deg)' }} />
          </div>
        </div>
      </div>

      {/* Foreground balloons (above everything) */}
      {/* <div ref={fgRef} className="pb-layer" style={{ zIndex: 110 }}>
        <Balloon className="b1" color="#ff4bb5" />
        <Balloon className="b2" color="#ffec5a" />
        <Balloon className="b3" color="#a35ef6" />
        <Balloon className="b4" color="#4acaf1" />
        <Balloon className="b5" color="#ff7d57" />
        <Balloon className="b6" color="#d9f85a" />
      </div> */}

      {/* Rising sparkles */}
      <div ref={sparkleRef} className="pointer-events-none absolute inset-0 z-[5]" />

      {/* Left column: feature chips */}
      <div className="pointer-events-none absolute left-[3%] top-1/2 z-[10] hidden -translate-y-1/2 flex-col gap-5 md:flex" style={{ animation: 'pb-fade 0.7s ease-out 0.8s both' }}>
        <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 backdrop-blur-md">
          <span className="text-2xl">📸</span>
          <div>
            <div className="text-sm font-black uppercase tracking-wider text-white">Foto </div>
            <div className="text-xs text-white/60">snap a trio</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 backdrop-blur-md">
          <span className="text-2xl">🖼️</span>
          <div>
            <div className="text-sm font-black uppercase tracking-wider text-white">Pilih frame favoritmu</div>
            <div className="text-xs text-white/60">make it yours</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 backdrop-blur-md">
          <span className="text-2xl">🖨️</span>
          <div>
            <div className="text-sm font-black uppercase tracking-wider text-white">Cetak Instan</div>
            <div className="text-xs text-white/60">and QR share</div>
          </div>
        </div>
      </div>

      {/* Right column: how it works */}
      <div className="pointer-events-none absolute right-[3%] top-1/2 z-[10] hidden -translate-y-1/2 flex-col items-end gap-6 text-right md:flex" style={{ animation: 'pb-fade 0.7s ease-out 0.9s both' }}>
        <h3 className="font-black uppercase tracking-[0.25em] text-white/80" style={{ fontFamily: "'Galada', cursive" }}>
          How it works
        </h3>
        <div className="flex flex-col items-end gap-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-sm font-black text-white">1 · Snap</div>
              <div className="text-xs text-white/55">follow the countdown</div>
            </div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#ffec5a] text-base font-black text-[#4a1870]">1</span>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <div className="text-sm font-black text-white">2 · Frame</div>
              <div className="text-xs text-white/55">add your style</div>
            </div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#ff7d57] text-base font-black text-black/70">2</span>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <div className="text-sm font-black text-white">3 · Print</div>
              <div className="text-xs text-white/55">grab your strip</div>
            </div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#4acaf1] text-base font-black text-black/70">3</span>
          </div>
        </div>
      </div>

      {/* Tap-to-start instruction */}
      <div className="absolute inset-x-0 bottom-0 z-[110] flex justify-center pb-10">
        <p
          className="flex items-center gap-3 text-2xl tracking-wide text-white md:text-3xl"
          style={{ fontFamily: "'Galada', cursive", animation: 'pb-bounce-in 1.4s ease 1s both, pb-glow 2.4s ease-in-out 2s infinite' }}
        >
          <span className="inline-block" style={{ animation: 'pb-tap 1.2s ease-in-out infinite' }}>👆</span>
          Tap anywhere to start your session
        </p>
      </div>
    </div>
  );
};

export default ManualPaymentScreen;