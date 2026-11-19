// One bounded, silent reveal. Timers follow the CSS edge-on swap and completion.
export function revealCards(elements, reveal, finish = () => {}, reward = false) {
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const duration = reduced ? 80 : reward ? 1500 : 780;
  const swapAt = reduced ? 0 : reward ? 860 : 340;
  const cards = [...elements];
  let done = false;
  const clean = () => cards.forEach(card => {
    card.classList.remove('card-reveal-fast', 'card-reveal-reward', 'card-reveal-front');
    card.removeAttribute('aria-busy');
    card.querySelector(':scope > .card-reveal-light')?.remove();
    card.querySelector(':scope > .card-reveal-wave')?.remove();
  });
  for (const card of cards) {
    card.classList.add(reward ? 'card-reveal-reward' : 'card-reveal-fast');
    card.setAttribute('aria-busy', 'true');
    const light = document.createElement('span');
    light.className = 'card-reveal-light';
    light.setAttribute('aria-hidden', 'true');
    const wave = document.createElement('span');
    wave.className = 'card-reveal-wave';
    wave.setAttribute('aria-hidden', 'true');
    card.append(wave, light);
  }
  const swap = setTimeout(() => { if (!done) {cards.forEach(card=>card.classList.add('card-reveal-front'));reveal();} }, swapAt);
  const end = setTimeout(() => {
    if (done) return;
    done = true;
    clean();
    finish();
  }, duration);
  return () => {
    done = true;
    clearTimeout(swap);
    clearTimeout(end);
    clean();
  };
}
