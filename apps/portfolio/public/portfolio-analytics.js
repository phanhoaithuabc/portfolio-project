(() => {
  const optedOut = () => {
    try {
      return (
        localStorage.getItem("portfolio.analytics-opt-out") === "true" ||
        navigator.doNotTrack === "1" ||
        navigator.globalPrivacyControl === true
      );
    } catch {
      return true;
    }
  };
  const send = (event) => {
    if (optedOut()) return;
    let referrerHost = "";
    try {
      if (document.referrer)
        referrerHost = new URL(document.referrer).hostname.toLowerCase();
    } catch {}
    void fetch("/api/analytics", {
      method: "POST",
      credentials: "omit",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        page: location.pathname,
        event,
        referrerHost,
      }),
    }).catch(() => {});
  };
  send("view");
  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[target="_blank"]') : null;
    if (!link || optedOut()) return;
    let destination;
    try { destination = new URL(link.href); } catch { return; }
    if (destination.hostname !== location.hostname) send("outbound");
  });
})();