// Lightweight GeoIP & Device Detection Service with In-Memory Caching

const geoCache = new Map();

/**
 * Checks if an IP is a local, loopback, or private network address
 */
function isPrivateIp(ip) {
  if (!ip) return true;
  const clean = ip.replace(/^::ffff:/, '').trim();
  if (
    clean === '127.0.0.1' || 
    clean === '::1' || 
    clean === 'localhost' ||
    clean.startsWith('10.') || 
    clean.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean) ||
    clean.startsWith('fc00:') ||
    clean.startsWith('fe80:')
  ) {
    return true;
  }
  return false;
}

/**
 * Resolves country and country code from an IP address
 */
export async function resolveCountry(ip) {
  if (!ip) {
    return { country: 'Unknown', countryCode: 'UN' };
  }

  const cleanIp = ip.replace(/^::ffff:/, '').trim();

  if (isPrivateIp(cleanIp)) {
    return { country: 'Local / Development', countryCode: 'DEV' };
  }

  // Check in-memory cache
  if (geoCache.has(cleanIp)) {
    return geoCache.get(cleanIp);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,country,countryCode`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'success') {
        const result = {
          country: data.country || 'Unknown',
          countryCode: data.countryCode || 'UN'
        };
        // Cache result (capped at 5000 IPs)
        if (geoCache.size > 5000) geoCache.clear();
        geoCache.set(cleanIp, result);
        return result;
      }
    }
  } catch (err) {
    // Non-blocking fallback
  }

  const fallback = { country: 'Global Visitor', countryCode: 'GL' };
  geoCache.set(cleanIp, fallback);
  return fallback;
}

/**
 * Detects device category from user agent string
 */
export function detectDevice(userAgent = '') {
  const ua = userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'Tablet';
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) return 'Mobile';
  return 'Desktop';
}
