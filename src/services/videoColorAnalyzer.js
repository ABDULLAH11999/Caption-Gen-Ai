// Video Frame Color & Luminance Analyzer
// Samples video frame pixels behind the caption area to adapt contrast, outline stroke, and colors

export class VideoColorAnalyzer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.lastResult = {
      luminance: 40,
      isLightBackground: false,
      dominantColor: '#0a101d',
      recommendedOutlineColor: '#000000',
      recommendedOutlineWidth: 1.5,
      recommendedShadow: '0 4px 14px rgba(0, 0, 0, 0.9)'
    };
    this.initCanvas();
  }

  initCanvas() {
    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 32;
      this.canvas.height = 32;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }
  }

  /**
   * Analyzes the video area where captions are positioned.
   * By default samples the middle-left quadrant (x: 5% - 60%, y: 35% - 70%)
   */
  analyzeVideoArea(videoElement, area = { xRel: 0.04, yRel: 0.35, wRel: 0.55, hRel: 0.32 }) {
    if (!videoElement || !this.ctx || videoElement.videoWidth === 0 || videoElement.readyState < 2) {
      return this.lastResult;
    }

    try {
      const vw = videoElement.videoWidth || 640;
      const vh = videoElement.videoHeight || 360;

      const sx = Math.max(0, Math.floor(vw * (area.xRel || 0.04)));
      const sy = Math.max(0, Math.floor(vh * (area.yRel || 0.35)));
      const sw = Math.min(vw - sx, Math.floor(vw * (area.wRel || 0.55)));
      const sh = Math.min(vh - sy, Math.floor(vh * (area.hRel || 0.32)));

      if (sw <= 0 || sh <= 0) return this.lastResult;

      this.ctx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, 32, 32);
      const imgData = this.ctx.getImageData(0, 0, 32, 32).data;

      let totalR = 0;
      let totalG = 0;
      let totalB = 0;
      let totalLuminance = 0;
      const pixelCount = 32 * 32;

      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        totalR += r;
        totalG += g;
        totalB += b;
        // Standard Rec. 601 / 709 perceived luminance formula
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        totalLuminance += lum;
      }

      const avgR = Math.round(totalR / pixelCount);
      const avgG = Math.round(totalG / pixelCount);
      const avgB = Math.round(totalB / pixelCount);
      const avgLum = Math.round(totalLuminance / pixelCount);

      // Background is considered light / plain white if average luminance > 130
      const isLightBackground = avgLum > 130;

      this.lastResult = {
        luminance: avgLum,
        isLightBackground,
        dominantColor: `rgb(${avgR}, ${avgG}, ${avgB})`,
        // Crisp solid black outline for white/light backgrounds
        recommendedOutlineColor: isLightBackground ? '#000000' : 'rgba(0, 0, 0, 0.85)',
        recommendedOutlineWidth: isLightBackground ? 2.5 : 1.2,
        recommendedShadow: isLightBackground
          ? '0 2px 10px rgba(0, 0, 0, 0.95), 0 0 2px #000000'
          : '0 4px 16px rgba(0, 0, 0, 0.9)',
        recommendedBackdrop: isLightBackground ? 'rgba(0, 0, 0, 0.42)' : 'transparent'
      };

      return this.lastResult;
    } catch (e) {
      // CORS or canvas tainted (safe fallback)
      return this.lastResult;
    }
  }
}

export const videoColorAnalyzer = new VideoColorAnalyzer();
