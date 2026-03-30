const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('origin_access_token');

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    console.log(`[API Call] ${options.method || 'GET'} ${endpoint}`, { headers });

    const response = await fetch(`${API_URL}${endpoint}`, {
        cache: 'no-store', // Prevent aggressive browser caching of GET requests
        ...options,
        headers,
    });

    if (!response.ok) {
        console.error(`[API Error] ${response.status} ${endpoint}`, {
            status: response.status,
            statusText: response.statusText
        });
        if (response.status === 401) {
            console.warn(`[API Unauthorized] Token might be invalid or missing for ${endpoint}`);
            // Handle token expiration/unauthorized appropriately (e.g. refresh token logic can go here)
            // localStorage.removeItem('origin_access_token');
            // localStorage.removeItem('origin_refresh_token');
        }
        const errorData = await response.json().catch(() => ({}));
        
        let errorMessage = errorData.detail || errorData.message || 'API Request Failed';
        
        if (errorData.non_field_errors) {
            errorMessage = Array.isArray(errorData.non_field_errors) 
                ? errorData.non_field_errors[0] 
                : errorData.non_field_errors;
        } else if (typeof errorData === 'object' && !errorData.detail) {
            // Handle field-specific errors if no general detail present
            const firstKey = Object.keys(errorData)[0];
            if (firstKey) {
                const val = errorData[firstKey];
                errorMessage = Array.isArray(val) ? val[0] : val;
                // Prepend key name for context if it's not non_field_errors
                if (firstKey !== 'non_field_errors' && typeof errorMessage === 'string' && !errorMessage.toLowerCase().includes(firstKey.toLowerCase())) {
                    errorMessage = `${firstKey}: ${errorMessage}`;
                }
            }
        }
        
        throw new Error(errorMessage);
    }

    // Handle empty responses
    const text = await response.text();
    return text ? JSON.parse(text) : {};
};
