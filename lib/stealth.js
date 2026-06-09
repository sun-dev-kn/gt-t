// Pure stealth utility functions — mirrored in content_script.js for testing.
// content_script.js is a classic script and cannot import ES modules.

export const rateLimitMap = new Map(); // origin → { count403: number, suspended: boolean, suspendedUntil: number }

export function buildStealthHeaders(origin) {
    return {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": origin + "/",
    };
}

export function randomDelay(min, max) {
    return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

export function isOriginSuspended(origin) {
    const state = rateLimitMap.get(origin);
    if (!state?.suspended) return false;
    if (Date.now() > state.suspendedUntil) {
        state.suspended = false;
        return false;
    }
    return true;
}

export function markRateLimited(origin) {
    rateLimitMap.set(origin, {
        count403: 0,
        suspended: true,
        suspendedUntil: Date.now() + 5 * 60 * 1000, // 5 minutes
    });
}

export function trackHttp403(origin) {
    const state = rateLimitMap.get(origin) || { count403: 0, suspended: false, suspendedUntil: 0 };
    state.count403 = (state.count403 || 0) + 1;
    rateLimitMap.set(origin, state);
    if (state.count403 >= 5) {
        markRateLimited(origin);
        return true; // suspended
    }
    return false;
}
