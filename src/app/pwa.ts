export function getServiceWorkerUrl(baseUrl = import.meta.env.BASE_URL): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBaseUrl}service-worker.js`;
}

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const serviceWorker = navigator.serviceWorker;
  const wasControlled = Boolean(serviceWorker.controller);
  let isRefreshing = false;
  serviceWorker.addEventListener("controllerchange", () => {
    if (!wasControlled || isRefreshing) {
      return;
    }

    isRefreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    void serviceWorker
      .register(getServiceWorkerUrl())
      .then((registration) => registration.update())
      .catch(() => undefined);
  });
}
