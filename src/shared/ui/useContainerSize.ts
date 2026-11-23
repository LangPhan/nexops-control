import { useEffect, useRef, useState } from 'react';

export function useContainerSize(fallbackWidth = 640, fallbackHeight = 280) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({
    width: fallbackWidth,
    height: fallbackHeight,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setSize({ width: Math.round(width), height: Math.round(height) });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, ...size };
}
