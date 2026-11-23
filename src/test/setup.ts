import '@testing-library/jest-dom';

if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
}

if (typeof HTMLCanvasElement !== 'undefined') {
  const noop = () => {};
  const ctxStub = {
    save: noop,
    restore: noop,
    scale: noop,
    translate: noop,
    setTransform: noop,
    fillRect: noop,
    beginPath: noop,
    arc: noop,
    moveTo: noop,
    lineTo: noop,
    fill: noop,
    stroke: noop,
    drawImage: noop,
    fillText: noop,
    createRadialGradient: () => ({ addColorStop: noop }),
  } as unknown as CanvasRenderingContext2D;

  HTMLCanvasElement.prototype.getContext = (() =>
    ctxStub) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}
