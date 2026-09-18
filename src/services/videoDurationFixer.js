import fixWebmDuration from 'fix-webm-duration';

/**
 * Universal Video Duration & Container Fixer for Browser MediaRecorder
 * Resolves:
 * 1. Missing duration in media players (shows 00:00 / 00:00 or infinity, cannot seek)
 * 2. WhatsApp "Can't send this video" errors caused by unfinalized live stream metadata
 */
export async function fixVideoMetadata(blob, durationSec) {
  if (!blob || durationSec <= 0) return blob;

  const durationMs = Math.max(100, Math.round(durationSec * 1000));
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // 1. Check if file is WebM (EBML header: 0x1A 0x45 0xDF 0xA3)
  const isWebm = (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) || blob.type.includes('webm');

  if (isWebm) {
    try {
      const fixedBlob = await fixWebmDuration(blob, durationMs);
      return fixedBlob;
    } catch (err) {
      console.warn('[VideoFixer] WebM duration injection warning:', err);
      return blob;
    }
  }

  // 2. Check if file is MP4 (contains 'ftyp' or 'moov' box in first 32 bytes)
  const isMp4 = (
    (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) || // 'ftyp'
    (bytes[4] === 0x6d && bytes[5] === 0x6f && bytes[6] === 0x6f && bytes[7] === 0x76) || // 'moov'
    blob.type.includes('mp4')
  );

  if (isMp4) {
    try {
      const patchedBuffer = patchMp4Boxes(arrayBuffer, durationSec);
      return new Blob([patchedBuffer], { type: 'video/mp4' });
    } catch (err) {
      console.warn('[VideoFixer] MP4 box patching warning:', err);
      return blob;
    }
  }

  return blob;
}

/**
 * Patches MP4 mvhd, mehd, tkhd, and mdhd boxes with the real duration
 * so players and messaging platforms (WhatsApp) can seek and validate length.
 */
function patchMp4Boxes(buffer, durationSec) {
  const view = new DataView(buffer);
  let movieTimescale = 1000;

  function parseBoxes(start, end) {
    let offset = start;
    while (offset + 8 <= end) {
      const size = view.getUint32(offset);
      const type = String.fromCharCode(
        view.getUint8(offset + 4),
        view.getUint8(offset + 5),
        view.getUint8(offset + 6),
        view.getUint8(offset + 7)
      );

      const boxSize = size === 1
        ? Number(view.getBigUint64(offset + 8))
        : (size === 0 ? end - offset : size);

      if (boxSize <= 0 || offset + boxSize > end) break;

      const headerSize = size === 1 ? 16 : 8;
      const contentOffset = offset + headerSize;
      const contentEnd = offset + boxSize;

      // Recursive container boxes
      if (type === 'moov' || type === 'trak' || type === 'mdia' || type === 'mvex' || type === 'minf') {
        parseBoxes(contentOffset, contentEnd);
      } else if (type === 'mvhd') {
        // Movie Header Box
        const version = view.getUint8(contentOffset);
        if (version === 0) {
          movieTimescale = view.getUint32(contentOffset + 12) || 1000;
          const targetDuration = Math.round(durationSec * movieTimescale);
          view.setUint32(contentOffset + 16, targetDuration);
        } else if (version === 1) {
          movieTimescale = view.getUint32(contentOffset + 20) || 1000;
          const targetDuration = BigInt(Math.round(durationSec * movieTimescale));
          view.setBigUint64(contentOffset + 24, targetDuration);
        }
      } else if (type === 'mehd') {
        // Movie Extends Header Box (Crucial for fragmented MP4 recorded in browsers)
        const version = view.getUint8(contentOffset);
        if (version === 0) {
          const targetDuration = Math.round(durationSec * movieTimescale);
          view.setUint32(contentOffset + 4, targetDuration);
        } else if (version === 1) {
          const targetDuration = BigInt(Math.round(durationSec * movieTimescale));
          view.setBigUint64(contentOffset + 4, targetDuration);
        }
      } else if (type === 'tkhd') {
        // Track Header Box
        const version = view.getUint8(contentOffset);
        if (version === 0) {
          const targetDuration = Math.round(durationSec * movieTimescale);
          view.setUint32(contentOffset + 20, targetDuration);
        } else if (version === 1) {
          const targetDuration = BigInt(Math.round(durationSec * movieTimescale));
          view.setBigUint64(contentOffset + 28, targetDuration);
        }
      } else if (type === 'mdhd') {
        // Media Header Box
        const version = view.getUint8(contentOffset);
        if (version === 0) {
          const trackTimescale = view.getUint32(contentOffset + 12) || 1000;
          const targetDuration = Math.round(durationSec * trackTimescale);
          view.setUint32(contentOffset + 16, targetDuration);
        } else if (version === 1) {
          const trackTimescale = view.getUint32(contentOffset + 20) || 1000;
          const targetDuration = BigInt(Math.round(durationSec * trackTimescale));
          view.setBigUint64(contentOffset + 24, targetDuration);
        }
      }

      offset += boxSize;
    }
  }

  parseBoxes(0, buffer.byteLength);
  return buffer;
}
