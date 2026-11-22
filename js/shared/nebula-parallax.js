export function initNebulaParallax() {
  const backdrop = document.querySelector('.sky-parallax');
  if (!backdrop) return;

  const layers = Array.from(backdrop.querySelectorAll('[data-speed]'), element => ({
    element,
    speed: Number(element.dataset.speed)
  }));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = null;
  let previousRange;

  function draw() {
    frame = null;
    const range = reducedMotion.matches ? 0 :
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const offset = Math.min(range, Math.max(0, window.scrollY));
    for (const {element, speed} of layers) {
      if (range !== previousRange) {
        element.style.setProperty('--sky-extra', `${Math.ceil(range * speed)}px`);
      }
      element.style.setProperty('--sky-offset', `${-offset * speed}px`);
    }
    previousRange = range;
  }

  function schedule() {
    if (frame === null) frame = window.requestAnimationFrame(draw);
  }

  window.addEventListener('scroll', () => {
    if (!reducedMotion.matches) schedule();
  }, {passive: true});
  window.addEventListener('resize', schedule, {passive: true});
  reducedMotion.addEventListener('change', schedule);
  new ResizeObserver(schedule).observe(document.body);
  schedule();
}
