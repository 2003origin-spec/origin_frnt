import { flushNativeCookies } from '@/native/bridge';

const APP_API_HOSTS = new Set(['o3origin.com', 'www.o3origin.com']);

function isVercelHost(hostname: string): boolean {
    return hostname === 'vercel.app' || hostname.endsWith('.vercel.app');
}

export function resolveApiBaseUrl(rawApiUrl = process.env.NEXT_PUBLIC_API_URL, locationOrigin?: string): string {
    const raw = rawApiUrl?.trim() || '/api';
    if (!/^https?:\/\//i.test(raw)) {
        return raw.replace(/\/+$/, '') || '/api';
    }

    try {
        const apiUrl = new URL(raw);
        const locationUrl = locationOrigin ? new URL(locationOrigin) : null;
        const pointsAtThisApp =
            apiUrl.hostname === locationUrl?.hostname ||
            APP_API_HOSTS.has(apiUrl.hostname) ||
            isVercelHost(apiUrl.hostname);

        if (pointsAtThisApp && apiUrl.pathname.startsWith('/api')) {
            const path = `${apiUrl.pathname}${apiUrl.search}`.replace(/\/+$/, '');
            return path || '/api';
        }

        return raw.replace(/\/+$/, '');
    } catch {
        return '/api';
    }
}

const API_URL = resolveApiBaseUrl(
    process.env.NEXT_PUBLIC_API_URL,
    typeof window !== 'undefined' ? window.location.origin : undefined,
);
const CSRF_COOKIE_NAME = 'origin_csrf';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function normalizeEndpoint(endpoint: string) {
    const [rawPath, ...queryParts] = endpoint.split('?');
    const path = rawPath || '/';
    const normalizedPath = path === '/' ? path : path.replace(/\/+$/, '');
    return queryParts.length ? `${normalizedPath}?${queryParts.join('?')}` : normalizedPath;
}

// Dispatched when the refresh token itself is expired — AuthContext listens and logs the user out
export const AUTH_EXPIRED_EVENT = 'origin:auth:expired';
export type TokenRefreshResult = 'ok' | 'expired' | 'transient';

let refreshPromise: Promise<TokenRefreshResult> | null = null;

type AuthExpiredReason = { code: 'account_revoked' | 'account_deleted'; detail: string };
let lastAuthExpiredReason: AuthExpiredReason | null = null;

/**
 * Reads and clears the last revoke/delete reason captured during a failed token
 * refresh, so the logout handler can show a precise notice instead of a generic
 * "session expired". Null when the failure was an ordinary expiry.
 */
export function consumeAuthExpiredReason(): AuthExpiredReason | null {
    const reason = lastAuthExpiredReason;
    lastAuthExpiredReason = null;
    return reason;
}

function readCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const prefix = `${name}=`;
    const match = document.cookie
        .split(';')
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith(prefix));
    return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

function isMutatingMethod(method: string | undefined): boolean {
    return !SAFE_METHODS.has((method ?? 'GET').toUpperCase());
}

export function classifyTokenRefreshStatus(status: number): TokenRefreshResult {
    if (status >= 200 && status < 300) return 'ok';
    if (status === 400 || status === 401 || status === 403) return 'expired';
    return 'transient';
}

async function performTokenRefresh(): Promise<TokenRefreshResult> {
    try {
        const response = await fetch(`${API_URL}/users/token/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
            credentials: 'include',
            cache: 'no-store',
        });
        const classified = classifyTokenRefreshStatus(response.status);
        if (classified === 'expired') {
            // Capture a precise revoke/delete reason (before the /me recovery,
            // which also fails for a revoked account) so the logout notice is exact.
            try {
                const body = await response.clone().json();
                const code = body?.code;
                if (code === 'account_revoked' || code === 'account_deleted') {
                    lastAuthExpiredReason = { code, detail: String(body?.detail ?? '') };
                }
            } catch {
                /* no JSON body */
            }
            if (await recoverSessionViaMe()) {
                return 'ok';
            }
        }
        if (classified === 'ok') {
            // Android shell: persist the rotated refresh cookie to disk NOW —
            // a process kill before Android's lazy cookie flush would strand
            // the user with a revoked refresh token (plan ledger #14).
            void flushNativeCookies();
        }
        return classified;
    } catch {
        return 'transient';
    }
}

async function recoverSessionViaMe(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
        const response = await fetch(`${API_URL}/users/me`, {
            credentials: 'include',
            cache: 'no-store',
        });
        return response.ok;
    } catch {
        return false;
    }
}

export async function attemptTokenRefresh(): Promise<TokenRefreshResult> {
    if (!refreshPromise) {
        refreshPromise = performTokenRefresh().finally(() => {
            refreshPromise = null;
        });
    }
    return refreshPromise;
}

function emitAuthExpired(silentAuth: boolean | undefined): void {
    if (!silentAuth && typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
}

async function ensureCsrfToken(method: string | undefined, silentAuth: boolean | undefined): Promise<void> {
    if (!isMutatingMethod(method) || readCookie(CSRF_COOKIE_NAME)) return;
    const refreshed = await attemptTokenRefresh();
    if (refreshed === 'ok') return;
    if (refreshed === 'expired') {
        emitAuthExpired(silentAuth);
        throw new Error('Session expired. Please log in again.');
    }
    throw new Error('Session refresh is temporarily unavailable. Please retry in a moment.');
}

function buildHeaders(method: string | undefined, body: BodyInit | null | undefined, overrides?: HeadersInit): Headers {
    const headers = new Headers(overrides);
    if (!(body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    if (isMutatingMethod(method) && !headers.has(CSRF_HEADER_NAME)) {
        const csrfToken = readCookie(CSRF_COOKIE_NAME);
        if (csrfToken) {
            headers.set(CSRF_HEADER_NAME, csrfToken);
        }
    }
    return headers;
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
export const apiCall = async (
    endpoint: string, 
    options: RequestInit & { silentAuth?: boolean } = {}
): Promise<any> => {
    const { silentAuth, ...fetchOptions } = options;
    const { cache = 'no-store', ...requestOptions } = fetchOptions;
    const normalizedEndpoint = normalizeEndpoint(endpoint);

    await ensureCsrfToken(requestOptions.method, silentAuth);

    const doFetch = () =>
        fetch(`${API_URL}${normalizedEndpoint}`, {
            ...requestOptions,
            cache,
            credentials: 'include',
            headers: buildHeaders(requestOptions.method, requestOptions.body, options.headers),
        });

    let response = await doFetch();

    // On 401, try refreshing the access token once then retry
    if (response.status === 401) {
        const refreshed = await attemptTokenRefresh();
        if (refreshed === 'ok') {
            response = await doFetch();
        } else if (refreshed === 'expired') {
            emitAuthExpired(silentAuth);
            throw new Error('Session expired. Please log in again.');
        } else {
            throw new Error('Session refresh is temporarily unavailable. Please retry in a moment.');
        }
    }

    if (!response.ok) {
        if (process.env.NODE_ENV === 'development') {
            console.error(`[API Error] ${response.status} ${normalizedEndpoint}`);
        }
        const errorData = await response.json().catch(() => ({}));
        // Preserve the HTTP status and any machine-readable `code` on the thrown
        // error so callers can react (e.g. AI Feature Toggle's AI_DISABLED).
        // Backward-compatible: still an Error with the same message.
        const error = new Error(parseErrorMessage(errorData)) as Error & {
            status?: number;
            code?: string;
        };
        error.status = response.status;
        if (
            errorData &&
            typeof errorData === 'object' &&
            typeof (errorData as { code?: unknown }).code === 'string'
        ) {
            error.code = (errorData as { code: string }).code;
        }
        throw error;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
};
