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
    const register = vi.fn().mockResolvedValue({ update: vi.fn() });
    const addEventListener = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { addEventListener, controller: null, register },
    });

    registerServiceWorker();
    window.dispatchEvent(new Event("load"));

    expect(register).toHaveBeenCalledWith(getServiceWorkerUrl());
    expect(addEventListener).toHaveBeenCalledWith(
      "controllerchange",
      expect.any(Function),
    );
  });

  it("checks for service worker updates after registration", async () => {
    const update = vi.fn();
    const register = vi.fn().mockResolvedValue({ update });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { addEventListener: vi.fn(), controller: null, register },
    });

    registerServiceWorker();
    window.dispatchEvent(new Event("load"));
    await Promise.resolve();

    expect(update).toHaveBeenCalledTimes(1);
  });
});
