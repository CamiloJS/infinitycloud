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

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
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
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
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
