
import { useEffect, useRef } from 'react';

const CHARS = '  ..::++xxXX00SS88##@@';
const FRAME_INTERVAL = 1000 / 25;
const CELL_SIZE = 9;

const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));

function noise(x, y) {
  const value = Math.sin(
    x * 127.1 + y * 311.7
  ) * 43758.5453;

  return value - Math.floor(value);
}

export default function JarvisHorizon() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;

    if (!canvas || !container) return undefined;

    const context = canvas.getContext('2d', {
      alpha: true,
    });

    if (!context) return undefined;

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frameId = 0;
    let lastFrame = 0;
    let elapsed = 0;
    let previousTime = 0;
    let visible = true;
    let running = true;

    function resize() {
      const rect = container.getBoundingClientRect();

      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);

      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      draw(elapsed);
    }

    function draw(time) {
      if (!width || !height) return;

      context.clearRect(0, 0, width, height);

      // A dark background matching the J.A.R.V.I.S. chat.
      context.fillStyle = '#0D0C15';
      context.fillRect(0, 0, width, height);

      const rows = Math.ceil(height / CELL_SIZE);
      const cols = Math.ceil(width / CELL_SIZE);

      const t = reducedMotion.matches ? 0 : time;

      // Bright region slowly shifts horizontally.
      const lightX =
        width * (
          0.5 +
          0.22 * Math.sin(t * 0.24)
        );

      const lightY =
        height * (
          0.07 +
          0.035 * Math.sin(t * 0.31)
        );

      const lightWidth = width * 0.45;

      // Soft cyan atmosphere behind the ASCII.
      const atmosphere = context.createRadialGradient(
        lightX,
        lightY,
        5,
        lightX,
        lightY,
        width * 0.8
      );

      atmosphere.addColorStop(
        0,
        'rgba(165,216,255,0.35)'
      );

      atmosphere.addColorStop(
        0.3,
        'rgba(34,211,238,0.19)'
      );

      atmosphere.addColorStop(
        0.65,
        'rgba(14,116,144,0.09)'
      );

      atmosphere.addColorStop(
        1,
        'rgba(13,12,21,0)'
      );

      context.fillStyle = atmosphere;
      context.fillRect(0, 0, width, height);

      context.font =
        '600 9px ui-monospace, Consolas, monospace';

      context.textAlign = 'center';
      context.textBaseline = 'middle';

      // The light gradually rolls across the horizon.
      const horizon =
        height * (
          0.49 +
          0.035 * Math.sin(t * 0.22)
        );

      for (let row = 0; row < rows; row++) {
        const y = row * CELL_SIZE + CELL_SIZE / 2;

        // Dense characters at the top, disappearing
        // toward the dark lower region.
        const vertical = clamp(
          (horizon - y) /
            Math.max(1, height * 0.28)
        );

        if (vertical <= 0) continue;

        for (let col = 0; col < cols; col++) {
          const x = col * CELL_SIZE + CELL_SIZE / 2;

          const staticNoise = noise(
            col * 0.9,
            row * 1.3
          );

          // Slowly changing wave geometry.
          const waveA = Math.sin(
            col * 0.18 +
            row * 0.24 +
            t * 0.56
          );

          const waveB = Math.cos(
            col * 0.095 -
            row * 0.17 -
            t * 0.35
          );

          const wave =
            0.5 +
            0.25 * waveA +
            0.25 * waveB;

          const distanceFromLight =
            (x - lightX) /
            Math.max(1, lightWidth);

          const brightArea = Math.exp(
            -distanceFromLight *
            distanceFromLight *
            2.2
          );

          const topIntensity = clamp(
            1 - y / Math.max(1, height * 0.75)
          );

          const intensity = clamp(
            0.17 +
            0.48 * brightArea +
            0.19 * wave +
            0.18 * topIntensity
          );

          // Animate individual glyphs by changing their
          // character selection at staggered intervals.
          const phase = Math.floor(
            t * (1.4 + staticNoise * 1.8) +
            staticNoise * 13
          );

          const changingNoise = noise(
            col * 1.37 + phase * 0.91,
            row * 1.73 - phase * 0.63
          );

          const glyphIndex = Math.min(
            CHARS.length - 1,
            Math.floor(
              clamp(
                intensity * 0.65 +
                changingNoise * 0.35
              ) * CHARS.length
            )
          );

          const char = CHARS[glyphIndex];

          if (char === ' ') continue;

          // Small gaps make the ASCII pattern organic.
          const gap = noise(
            col * 3.1 + phase * 0.15,
            row * 2.7
          );

          if (gap < 0.12) continue;

          const alpha = clamp(
            vertical *
            (0.3 + intensity * 0.8) *
            (0.65 + staticNoise * 0.35)
          );

          const icyWhite = clamp(
            (intensity - 0.62) * 2.8
          );

          const red = Math.round(
            34 + icyWhite * 212
          );

          const green = Math.round(
            185 + icyWhite * 63
          );

          const blue = Math.round(
            216 + icyWhite * 39
          );

          context.fillStyle =
            `rgba(${red},${green},${blue},${alpha})`;

          context.fillText(char, x, y);
        }
      }

      // Add a soft cyan light along the horizon.
      const horizonGlow = context.createLinearGradient(
        0,
        height * 0.25,
        0,
        height * 0.85
      );

      horizonGlow.addColorStop(
        0,
        'rgba(34,211,238,0)'
      );

      horizonGlow.addColorStop(
        0.32,
        'rgba(34,211,238,0.07)'
      );

      horizonGlow.addColorStop(
        0.65,
        'rgba(34,211,238,0.025)'
      );

      horizonGlow.addColorStop(
        1,
        'rgba(13,12,21,0)'
      );

      context.fillStyle = horizonGlow;
      context.fillRect(0, 0, width, height);

      // Smooth fade into the dark bottom.
      const fade = context.createLinearGradient(
        0,
        height * 0.27,
        0,
        height
      );

      fade.addColorStop(
        0,
        'rgba(13,12,21,0)'
      );

      fade.addColorStop(
        0.35,
        'rgba(13,12,21,0.15)'
      );

      fade.addColorStop(
        0.7,
        'rgba(13,12,21,0.7)'
      );

      fade.addColorStop(
        1,
        'rgba(13,12,21,1)'
      );

      context.fillStyle = fade;
      context.fillRect(0, 0, width, height);
    }

    function animate(timestamp) {
      if (!running) return;

      frameId = requestAnimationFrame(animate);

      if (
        document.hidden ||
        !visible ||
        reducedMotion.matches
      ) {
        previousTime = timestamp;
        return;
      }

      if (timestamp - lastFrame < FRAME_INTERVAL) {
        return;
      }

      const delta = previousTime
        ? Math.min(
            (timestamp - previousTime) / 1000,
            0.1
          )
        : 0;

      previousTime = timestamp;
      lastFrame = timestamp;
      elapsed += delta;

      draw(elapsed);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver(
      entries => {
        visible = entries.some(
          entry => entry.isIntersecting
        );
      }
    );

    intersectionObserver.observe(canvas);

    const onMotionChange = () => {
      if (reducedMotion.matches) {
        elapsed = 0;
        draw(0);
      }
    };

    reducedMotion.addEventListener?.(
      'change',
      onMotionChange
    );

    resize();

    frameId = requestAnimationFrame(animate);

    return () => {
      running = false;

      cancelAnimationFrame(frameId);

      resizeObserver.disconnect();
      intersectionObserver.disconnect();

      reducedMotion.removeEventListener?.(
        'change',
        onMotionChange
      );
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{
        backgroundColor: '#0D0C15',
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{
          display: 'block',
          backgroundColor: 'transparent',
        }}
      />
    </div>
  );
}
