import { describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "../../src/app/pwa";

describe("registerServiceWorker", () => {
  it("registers the app service worker after the window load event", () => {
    const register = vi.fn().mockResolvedValue({});
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    registerServiceWorker();
    window.dispatchEvent(new Event("load"));

    expect(register).toHaveBeenCalledWith("/service-worker.js");
  });
});
