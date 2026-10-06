import React, { useEffect, useRef } from 'react';

/**
 * Logical size booth screens are previewed at. 16:9 matches the booth display,
 * and 1280px is wide enough that every Tailwind breakpoint the real screens use
 * (`sm`/`md`/`lg`/`xl`) is in its intended range.
 */
const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;

export interface BoothPreviewStageProps {
  children: React.ReactNode;
  className?: string;
  /** Extra classes for the scaled 16:9 box (border, rounding, background). */
  frameClassName?: string;
  /** Inline styles for the scaled 16:9 box — the booth background lives here. */
  frameStyle?: React.CSSProperties;
}

/**
 * Renders the real booth screens at booth proportions inside the admin editor.
 *
 * The 16:9 ratio is structural rather than measured: the frame's height is
 * always `width * 9 / 16` via `aspect-ratio`, so collapsing or expanding the
 * admin sidebar can only change the frame's width — never its shape. Layout and
 * paint containment stop anything rendered inside from feeding back into that
 * size.
 *
 * Scaling uses CSS `zoom` rather than `transform: scale()` on purpose. The booth
 * views are viewport-unit-free and fill their parent, but they position layers
 * absolutely; a transform would leave the scaled box overflowing its parent.
 * `zoom` shrinks the laid-out box itself, so the result matches a real booth
 * display at that size.
 */
export const BoothPreviewStage: React.FC<BoothPreviewStageProps> = ({
  children,
  className,
  frameClassName,
  frameStyle,
}) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;

    // Written straight to the DOM rather than React state: a sidebar toggle
    // should resize the preview without re-rendering the editor or the screens
    // inside it.
    const sync = (frameWidth: number) => {
      if (frameWidth <= 0) return;
      content.style.zoom = String(frameWidth / BASE_WIDTH);
    };

    const measure = () => sync(frame.getBoundingClientRect().width);

    measure();

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) sync(entry.contentRect.width);
    });
    observer.observe(frame);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <div className={className}>
      {/* The frame owns the ratio; the content is scaled to fit it exactly.
          Capping the width by a viewport-relative height keeps a wide editor
          (e.g. sidebar collapsed) from pushing the preview off-screen, and
          because only the width is capped the 16:9 shape is preserved. */}
      <div
        ref={frameRef}
        className={`relative mx-auto w-full overflow-hidden ${frameClassName ?? ''}`}
        style={{
          aspectRatio: `${BASE_WIDTH} / ${BASE_HEIGHT}`,
          maxWidth: 'calc(72vh * 16 / 9)',
          contain: 'layout paint',
          ...frameStyle,
        }}
      >
        <div ref={contentRef} style={{ width: BASE_WIDTH, height: BASE_HEIGHT }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default BoothPreviewStage;
