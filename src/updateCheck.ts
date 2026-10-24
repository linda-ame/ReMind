/**
 * Home-screen / standalone web apps (especially iOS) may keep a stale HTML shell.
 * Compare the running build id with /version.json and reload when a new deploy is live.
 */
export function startUpdateCheck(): void {
  if (!import.meta.env.PROD) return;

  const RELOAD_KEY = 'remind-reload-for';
  let checking = false;

  async function check(): Promise<void> {
    if (checking) return;
    checking = true;
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;

      const data = (await res.json()) as { version?: string };
      const remote = data.version;
      if (!remote) return;

      if (remote === __REMIND_BUILD__) {
        sessionStorage.removeItem(RELOAD_KEY);
        return;
      }

      // Avoid a reload loop if the document is still served from a broken cache.
      if (sessionStorage.getItem(RELOAD_KEY) === remote) return;
      sessionStorage.setItem(RELOAD_KEY, remote);
      window.location.reload();
    } catch {
      // Offline or transient network — ignore.
    } finally {
      checking = false;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) void check();
  });
  window.setTimeout(() => void check(), 1200);
}
