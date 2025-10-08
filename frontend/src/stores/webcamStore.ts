import { create } from 'zustand';

interface WebcamStore {
  webcam: any | null; // react-webcam instance
  register: (ref: any | null) => void;
  getScreenshot: () => string | null;
  ready: boolean;
  setReady: (r: boolean) => void;
  capturing: boolean;
  lastCaptureAt: number | null;
  lastResult?: { success: boolean; attempts: number; durationMs: number; reason?: string };
  reliableCapture: () => Promise<string | null>;
}

export const useWebcamStore = create<WebcamStore>((set, get) => ({
  webcam: null,
  ready: false,
  capturing: false,
  lastCaptureAt: null,
  register: (ref) => set({ webcam: ref }),
  setReady: (r) => set({ ready: r }),
  getScreenshot: () => {
    const w = get().webcam;
    if (!w) return null;
    try { return w.getScreenshot(); } catch { return null; }
  },
  reliableCapture: async () => {
  const video: HTMLVideoElement | null = document.querySelector('video');
    // dynamic import to avoid early bundling issues
    const { captureReliable } = await import('../lib/capture');
    set({ capturing: true });
    const res = await captureReliable(get().getScreenshot, video, { quality: 0.9, maxAttempts: 5, attemptDelayMs: 120 });
    set({ capturing: false, lastCaptureAt: Date.now(), lastResult: { success: res.success, attempts: res.attempts, durationMs: res.durationMs, reason: res.reason } });
    return res.success ? res.dataUrl || null : null;
  }
}));
