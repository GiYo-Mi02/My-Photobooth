export interface CaptureOptions {
  maxAttempts?: number;        // total attempts (including first)
  quality?: number;            // jpeg quality 0..1
  width?: number;              // target width (optional, if scaling)
  height?: number;             // target height (optional, if scaling)
  attemptDelayMs?: number;     // base delay between attempts
  scaleMode?: 'cover' | 'contain' | 'none';
}

export interface CaptureResult {
  success: boolean;
  dataUrl?: string;
  attempts: number;
  reason?: string;
  width?: number;
  height?: number;
  durationMs: number;
}

const defaultOpts: Required<CaptureOptions> = {
  maxAttempts: 6,
  quality: 0.9,
  width: 0,
  height: 0,
  attemptDelayMs: 140,
  scaleMode: 'none'
};

export function captureFromElements(video: HTMLVideoElement | null, opts: CaptureOptions = {}): CaptureResult {
  const merged = { ...defaultOpts, ...opts };
  const start = performance.now();
  if (!video || video.readyState < 2) {
    return { success: false, attempts: 0, reason: 'video-not-ready', durationMs: performance.now() - start };
  }
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) {
    return { success: false, attempts: 0, reason: 'video-dimensions-zero', durationMs: performance.now() - start };
  }
  // Determine target size
  let targetW = merged.width || vw;
  let targetH = merged.height || vh;
  if (merged.width && merged.height && merged.scaleMode !== 'none') {
    const ratio = vw / vh;
    const tr = targetW / targetH;
    if (merged.scaleMode === 'cover') {
      if (ratio > tr) {
        // wider than target ratio -> height-bound
        targetW = targetH * ratio;
      } else {
        targetH = targetW / ratio;
      }
    } else if (merged.scaleMode === 'contain') {
      if (ratio > tr) {
        // wider -> width-bound
        targetH = targetW / ratio;
      } else {
        targetW = targetH * ratio;
      }
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(targetW);
  canvas.height = Math.round(targetH);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { success: false, attempts: 0, reason: 'no-2d-context', durationMs: performance.now() - start };
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  try {
    const dataUrl = canvas.toDataURL('image/jpeg', merged.quality);
    return { success: true, dataUrl, attempts: 1, width: canvas.width, height: canvas.height, durationMs: performance.now() - start };
  } catch (e: any) {
    return { success: false, attempts: 1, reason: e?.message || 'canvas-toDataURL-failed', durationMs: performance.now() - start };
  }
}

export async function captureReliable(
  getScreenshot: (() => string | null) | null,
  video: HTMLVideoElement | null,
  opts: CaptureOptions = {}
): Promise<CaptureResult> {
  const merged = { ...defaultOpts, ...opts };
  const start = performance.now();
  let attempts = 0;
  for (; attempts < merged.maxAttempts; attempts++) {
    // First try native screenshot if available
    if (getScreenshot) {
      try {
        const shot = getScreenshot();
        if (shot && shot.startsWith('data:image')) {
          return { success: true, dataUrl: shot, attempts: attempts + 1, durationMs: performance.now() - start };
        }
      } catch {/* ignore and fallback */}
    }
    // Fallback to canvas extraction
    const res = captureFromElements(video, merged);
    if (res.success) {
      res.attempts = attempts + 1;
      res.durationMs = performance.now() - start;
      return res;
    }
    // Delay before next attempt
    await new Promise(r => setTimeout(r, merged.attemptDelayMs * (attempts + 1))); // linear backoff
  }
  return { success: false, attempts, reason: 'exhausted-attempts', durationMs: performance.now() - start };
}

export function formatBytes(num: number): string {
  if (!num && num !== 0) return '';
  const units = ['B','KB','MB','GB'];
  let i = 0; let n = num;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${units[i]}`;
}
