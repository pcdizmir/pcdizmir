const EVENT_START = Date.parse('2026-10-26T12:00:00+03:00');
const NEXT_DAY = Date.parse('2026-10-27T00:00:00+03:00');

export function getCountdownParts(now = Date.now()) {
  const remainingSeconds = Math.max(0, Math.ceil((EVENT_START - now) / 1000));

  return {
    days: Math.floor(remainingSeconds / 86400),
    hours: Math.floor((remainingSeconds % 86400) / 3600),
    minutes: Math.floor((remainingSeconds % 3600) / 60),
    seconds: remainingSeconds % 60,
  };
}

export function initializeEventCountdown() {
  const countdown = document.getElementById('event-countdown');
  if (!countdown) return;

  const title = countdown.querySelector('.hero-countdown-title');
  const values = countdown.querySelector('.hero-countdown-values');
  const status = countdown.querySelector('.hero-countdown-status');
  const units = Object.fromEntries(
    [...countdown.querySelectorAll('[data-countdown-unit]')]
      .map((element) => [element.dataset.countdownUnit, element])
  );

  function render() {
    const now = Date.now();

    if (now >= NEXT_DAY) {
      countdown.hidden = true;
      window.clearInterval(intervalId);
      return;
    }

    const hasStarted = now >= EVENT_START;
    title.hidden = hasStarted;
    values.hidden = hasStarted;
    status.hidden = !hasStarted;
    if (hasStarted) return;

    const parts = getCountdownParts(now);
    for (const [unit, element] of Object.entries(units)) {
      element.textContent = String(parts[unit]).padStart(2, '0');
    }
  }

  const intervalId = window.setInterval(render, 1000);
  render();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) render();
  });
}
