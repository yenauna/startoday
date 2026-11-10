let pendingPwaInstall = null;
export function setupPwa() {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    pendingPwaInstall = event;
  });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(() => {});
}
export async function requestPwaInstall() {
  if (!pendingPwaInstall) return false;
  const event = pendingPwaInstall;
  pendingPwaInstall = null;
  await event.prompt();
  await event.userChoice;
  return true;
}
