import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useBoothAppearance } from '../store/appearanceStore';
import { withAlpha } from '../lib/appearance';
import { navigateToAdmin } from '../lib/navigation';
import BumperView from '../components/booth/BumperView';

type Flavor = 'pink' | 'lime';

interface ThemePalette {
  inner: string;
  mid: string;
  outer: string;
}

/** Sparkle colors that the appearance theme has no token for. */
const EXTRA_SPARKLE_COLORS = ['#ffec5a', '#ffffff'];

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


const photoAsset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

const PHOTOS = [
  photoAsset('photos/1.jpg'),
  photoAsset('photos/2.jpg'),
  photoAsset('photos/3.jpg'),
];

export const ContextBumperScreen: React.FC = () => {
  const confirmPayment = useSessionStore((state) => state.confirmPayment);
  const { copy, theme } = useBoothAppearance((state) => state.active);
  // Which of the two bumper gradients is currently showing.
  const [flavor, setFlavor] = useState<Flavor>('pink');
  const [pinOpen, setPinOpen] = useState(false);
  const [pinDigits, setPinDigits] = useState<string[]>([]);
  const [pinError, setPinError] = useState(false);

  const ADMIN_PIN = '250503';

  // Gradients and decoration colors follow the admin appearance. The animation
  // loops below are long-lived effects, so the derived palettes are mirrored into
  // refs — they read the latest theme without resubscribing on every change.
  const themes = useMemo<Record<Flavor, ThemePalette>>(
    () => ({
      pink: { inner: theme.bumperInner, mid: theme.bumperMid, outer: theme.bumperOuter },
      lime: {
        inner: theme.bumperAltInner,
        mid: theme.bumperAltMid,
        outer: theme.bumperAltOuter,
      },
    }),
    [theme],
  );
  const sparkleColors = useMemo(
    () => [
      theme.primary,
      theme.tertiary,
      theme.accent,
      theme.action,
      theme.secondary,
      ...EXTRA_SPARKLE_COLORS,
    ],
    [theme],
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const collageWrapRef = useRef<HTMLDivElement>(null);
  const collageRef = useRef<HTMLDivElement>(null);
  const sparkleRef = useRef<HTMLDivElement>(null);

  const switchingRef = useRef(false);
  const spinRef = useRef(0);
  const themeRef = useRef<Flavor>('pink');
  const themesRef = useRef(themes);
  themesRef.current = themes;
  const sparkleColorsRef = useRef(sparkleColors);
  sparkleColorsRef.current = sparkleColors;
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
      const color = sparkleColorsRef.current[Math.floor(Math.random() * sparkleColorsRef.current.length)];
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
    const from = themesRef.current[themeRef.current];
    const to = themesRef.current[flavor];
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
        setFlavor(flavor);

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

  return (
    <div className="fixed inset-0 z-[60]">
      <BumperView
        copy={copy}
        theme={theme}
        flavor={flavor}
        palette={themes[flavor]}
        photos={PHOTOS}
        refs={{ rootRef, farRef, bgRef, collageWrapRef, collageRef, sparkleRef }}
        onAdvance={confirmPayment}
        onOpenPin={() => setPinOpen(true)}
      />

      {/* Admin PIN modal — gate to camera settings */}
      {pinOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ backgroundColor: withAlpha(theme.deep, 0.8) }}
          onClick={(e) => {
            e.stopPropagation();
            closePin();
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={copy.bumperPinTitle}
            className="w-full max-w-xs rounded-[24px] border-4 p-6 text-center shadow-2xl"
            style={{ borderColor: theme.primary, backgroundColor: theme.card, color: theme.cardForeground }}
          >
            <h3
              className="text-[0.9rem] font-black uppercase tracking-[0.14em]"
              style={{ color: theme.secondary }}
            >
              {copy.bumperPinTitle}
            </h3>
            <p className="mt-1 text-[0.7rem] font-bold tracking-wide text-[#6d6a7f]">{copy.bumperPinSubtitle}</p>

            {/* PIN dots */}
            <div className="mt-5 flex items-center justify-center gap-3">
              {Array.from({ length: 6 }, (_, i) => (
                <span
                  key={i}
                  className="h-4 w-4 rounded-full border-2"
                  style={{
                    borderColor: pinDigits[i] ? (pinError ? theme.destructive : theme.primary) : theme.secondary,
                    backgroundColor: pinDigits[i] ? (pinError ? theme.destructive : theme.primary) : theme.card,
                  }}
                />
              ))}
            </div>
            {pinError && (
              <p className="mt-2 text-[0.7rem] font-black uppercase tracking-[0.1em]" style={{ color: theme.destructive }}>
                {copy.bumperPinError}
              </p>
            )}

            {/* Numpad */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handlePinKey(digit)}
                  className="rounded-[14px] border-[3px] bg-white py-3 text-xl font-black shadow-[0_3px_0_rgba(77,45,133,0.2)] active:translate-y-0.5"
                  style={{ borderColor: theme.secondary, color: theme.secondary }}
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handlePinBackspace}
                aria-label="Delete digit"
                className="rounded-[14px] border-[3px] bg-white py-3 text-xl font-black shadow-[0_3px_0_rgba(77,45,133,0.2)] active:translate-y-0.5"
                style={{ borderColor: theme.secondary, color: theme.secondary }}
              >
                ⌫
              </button>
              <button
                type="button"
                onClick={() => handlePinKey('0')}
                className="rounded-[14px] border-[3px] bg-white py-3 text-xl font-black shadow-[0_3px_0_rgba(77,45,133,0.2)] active:translate-y-0.5"
                style={{ borderColor: theme.secondary, color: theme.secondary }}
              >
                0
              </button>
              <button
                type="button"
                onClick={closePin}
                aria-label="Close"
                className="rounded-[14px] border-[3px] py-3 text-xl font-black text-white shadow-[0_3px_0_rgba(0,0,0,0.2)] active:translate-y-0.5"
                style={{ backgroundColor: theme.destructive, borderColor: theme.destructive }}
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
