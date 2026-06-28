import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

type FetchEvent = {
  request: Request;
  respondWith: (response: Promise<Response>) => void;
  response?: Promise<Response>;
};

declare global {
  var __serviceWorkerCachesMock: {
    delete: ReturnType<typeof vi.fn>;
    keys: ReturnType<typeof vi.fn>;
    match: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
  };
  var __serviceWorkerFetchMock: ReturnType<typeof vi.fn>;
}

describe("service worker", () => {
  it("uses network-first responses for app navigations", async () => {
    const listeners = loadServiceWorker();
    const cachedResponse = new Response("cached shell");
    const networkResponse = new Response("fresh shell", {
      headers: { "content-type": "text/html" },
    });
    const cachesMock = globalThis.__serviceWorkerCachesMock;

    cachesMock.match.mockResolvedValue(cachedResponse);
    cachesMock.open.mockResolvedValue({ put: vi.fn() });
    globalThis.__serviceWorkerFetchMock.mockResolvedValue(networkResponse);

    const navigationRequest = new Request("https://example.com/helper_tracker/", {
        headers: { accept: "text/html" },
      });
    Object.defineProperty(navigationRequest, "mode", { value: "navigate" });

    const event: FetchEvent = {
      request: navigationRequest,
      respondWith(response) {
        this.response = response;
      },
    };

    listeners.fetch(event);

    await expect(event.response).resolves.toBe(networkResponse);
    expect(globalThis.__serviceWorkerFetchMock).toHaveBeenCalledWith(event.request);
    expect(cachesMock.match).not.toHaveBeenCalled();
  });
});

function loadServiceWorker() {
  const listeners: Record<string, (event: FetchEvent) => void> = {};
  const cachesMock = {
    delete: vi.fn(),
    keys: vi.fn(),
    match: vi.fn(),
    open: vi.fn(),
  };
  const fetchMock = vi.fn();
  const context = {
    URL,
    Request,
    Response,
    caches: cachesMock,
    fetch: fetchMock,
    self: {
      addEventListener(type: string, listener: (event: FetchEvent) => void) {
        listeners[type] = listener;
      },
      clients: { claim: vi.fn() },
      location: { origin: "https://example.com" },
      registration: { scope: "https://example.com/helper_tracker/" },
      skipWaiting: vi.fn(),
    },
  };

  vm.runInNewContext(
    readFileSync("public/service-worker.js", "utf8"),
    context,
  );

  globalThis.__serviceWorkerCachesMock = cachesMock;
  globalThis.__serviceWorkerFetchMock = fetchMock;

  return listeners;
}
