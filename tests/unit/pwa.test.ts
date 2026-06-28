import { describe, expect, it, vi } from "vitest";
import { getServiceWorkerUrl, registerServiceWorker } from "../../src/app/pwa";

describe("getServiceWorkerUrl", () => {
  it("uses the deployed base path when the app is hosted below a repository path", () => {
    expect(getServiceWorkerUrl("/helper_tracker/")).toBe(
      "/helper_tracker/service-worker.js",
    );
    expect(getServiceWorkerUrl("/helper_tracker")).toBe(
      "/helper_tracker/service-worker.js",
    );
  });
});

describe("registerServiceWorker", () => {
  it("registers the app service worker after the window load event", () => {
    const register = vi.fn().mockResolvedValue({});
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    registerServiceWorker();
    window.dispatchEvent(new Event("load"));

    expect(register).toHaveBeenCalledWith(getServiceWorkerUrl());
  });
});
