const API_URL = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/+$/, '');

function normalizeEndpoint(endpoint: string) {
    const [rawPath, ...queryParts] = endpoint.split('?');
    const path = rawPath || '/';
    const normalizedPath = path === '/' ? path : path.replace(/\/+$/, '');
    return queryParts.length ? `${normalizedPath}?${queryParts.join('?')}` : normalizedPath;
}

// Dispatched when the refresh token itself is expired — AuthContext listens and logs the user out
export const AUTH_EXPIRED_EVENT = 'origin:auth:expired';
// Dispatched when a new access token is obtained via refresh — AuthContext listens and updates its in-memory state
export const TOKEN_REFRESHED_EVENT = 'origin:auth:refreshed';

async function attemptTokenRefresh(): Promise<string | null> {
    const refreshToken = localStorage.getItem('origin_refresh_token');
    if (!refreshToken) return null;

    try {
        const response = await fetch(`${API_URL}/users/token/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: refreshToken }),
        });
        if (!response.ok) return null;
        const data = await response.json();
        if (!data.access) return null;
        localStorage.setItem('origin_access_token', data.access);
        if (data.refresh) localStorage.setItem('origin_refresh_token', data.refresh);
        window.dispatchEvent(new CustomEvent(TOKEN_REFRESHED_EVENT, { detail: { access: data.access, refresh: data.refresh } }));
        return data.access;
    } catch {
        return null;
    }
}

function buildHeaders(token: string | null, overrides?: HeadersInit): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(overrides as Record<string, string> ?? {}),
    };
}

function parseErrorMessage(errorData: Record<string, unknown>): string {
    if (errorData.detail) return String(errorData.detail);
    if (errorData.message) return String(errorData.message);
    if (errorData.non_field_errors) {
        const v = errorData.non_field_errors;
        return Array.isArray(v) ? String(v[0]) : String(v);
    }
    const firstKey = Object.keys(errorData)[0];
    if (firstKey) {
        const val = errorData[firstKey];
        const msg = Array.isArray(val) ? String(val[0]) : String(val);
        if (!msg.toLowerCase().includes(firstKey.toLowerCase())) {
            return `${firstKey}: ${msg}`;
        }
        return msg;
    }
    return 'API Request Failed';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const apiCall = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
    const normalizedEndpoint = normalizeEndpoint(endpoint);

    if (process.env.NODE_ENV === 'development') {
        console.log(`[API Call] ${options.method || 'GET'} ${normalizedEndpoint}`);
    }

    const doFetch = (token: string | null) =>
        fetch(`${API_URL}${normalizedEndpoint}`, {
            ...options,
            cache: 'no-store',
            headers: buildHeaders(token, options.headers),
        });

    let token = localStorage.getItem('origin_access_token');
    let response = await doFetch(token);

    // On 401, try refreshing the access token once then retry
    if (response.status === 401) {
        const newToken = await attemptTokenRefresh();
        if (newToken) {
            token = newToken;
            response = await doFetch(token);
        } else {
            // Refresh failed — session is fully expired, force logout
            localStorage.removeItem('origin_access_token');
            localStorage.removeItem('origin_refresh_token');
            window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
            throw new Error('Session expired. Please log in again.');
        }
    }

    if (!response.ok) {
        if (process.env.NODE_ENV === 'development') {
            console.error(`[API Error] ${response.status} ${normalizedEndpoint}`);
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(parseErrorMessage(errorData));
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
};
