/**
 * Draws a video frame into a canvas with 16:9 aspect cover-cropping,
 * eliminating letterboxing/black bars and avoiding distortion.
 */
export function drawCoverCrop(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  targetWidth = 640,
  targetHeight = 360
): void {
  const vw = video.videoWidth || targetWidth;
  const vh = video.videoHeight || targetHeight;
  const targetAspect = targetWidth / targetHeight; // 16:9 ≈ 1.777
  const videoAspect = vw / vh;

  let sx = 0;
  let sy = 0;
  let sWidth = vw;
  let sHeight = vh;

  if (videoAspect > targetAspect) {
    // Video is wider than 16:9 (e.g., 21:9 ultrawide) -> crop left & right
    sWidth = vh * targetAspect;
    sx = (vw - sWidth) / 2;
  } else if (videoAspect < targetAspect) {
    // Video is narrower than 16:9 (e.g., 4:3 or 9:16 vertical) -> crop top & bottom
    sHeight = vw / targetAspect;
    sy = (vh - sHeight) / 2;
  }

  ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
}

/**
 * Utility to capture an automatic 16:9 thumbnail frame from any HTML5 video
 */
export async function captureVideoFrame(videoElement: HTMLVideoElement): Promise<string | null> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    drawCoverCrop(ctx, videoElement, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.88);
  } catch (err) {
    console.warn('Could not capture frame from video element:', err);
    return null;
  }
}

export async function generateAutoVideoThumbnail(videoUrl: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = videoUrl;
      video.muted = true;
      video.preload = 'metadata';

      const cleanup = () => {
        video.onloadeddata = null;
        video.onerror = null;
        video.onseeked = null;
      };

      const timer = setTimeout(() => {
        cleanup();
        resolve(null);
      }, 6000);

      video.onloadeddata = () => {
        // Seek to 1 second or 10%
        const targetTime = Math.min(1.5, (video.duration || 10) / 2);
        video.currentTime = targetTime;
      };

      video.onseeked = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 360;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            drawCoverCrop(ctx, video, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
            cleanup();
            resolve(dataUrl);
            return;
          }
        } catch {
          // CORS or export error
        }
        cleanup();
        resolve(null);
      };

      video.onerror = () => {
        clearTimeout(timer);
        cleanup();
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}
