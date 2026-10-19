export function drawCoverCrop(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | HTMLImageElement,
  targetWidth = 640,
  targetHeight = 360
): void {
  const isVideo = 'videoWidth' in video;
  const vw = (isVideo ? video.videoWidth : video.naturalWidth || video.width) || targetWidth;
  const vh = (isVideo ? video.videoHeight : video.naturalHeight || video.height) || targetHeight;
  const targetAspect = targetWidth / targetHeight; // 16:9 ≈ 1.777
  const videoAspect = vw / vh;

  let sx = 0;
  let sy = 0;
  let sWidth = vw;
  let sHeight = vh;

  if (videoAspect > targetAspect) {
    // Media is wider than 16:9 -> crop left & right
    sWidth = vh * targetAspect;
    sx = (vw - sWidth) / 2;
  } else if (videoAspect < targetAspect) {
    // Media is narrower than 16:9 -> crop top & bottom
    sHeight = vw / targetAspect;
    sy = (vh - sHeight) / 2;
  }

  ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
}

/**
 * Reads an uploaded image File, converts it to 16:9 format with smart cover cropping
 * to avoid letterboxing/distortion, and outputs a high-quality, lightweight Data URL.
 */
export async function processUploadedThumbnail(
  file: File,
  targetWidth = 640,
  targetHeight = 360
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('El archivo seleccionado no es una imagen válida (debe ser JPG, PNG, WebP o similar).'));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('No se pudo inicializar el lienzo para recortar la imagen.'));
          }

          drawCoverCrop(ctx, img, targetWidth, targetHeight);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo desde el dispositivo.'));
    reader.readAsDataURL(file);
  });
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
