// Load environment variables from window.__ENV__ if available
const ENV = (typeof window !== 'undefined' && window.__ENV__) || {};

// Also check Vite env (loaded from .env.local)
const VITE_ENV = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

// API Configuration
// NOTE: OpenAI API key is backend-only (not exposed to frontend).
// All AI calls go through /api/ai/* which is proxied to the FastAPI backend.
const API_CONFIG = {
    MAPBOX: {
        ACCESS_TOKEN: ENV.VITE_MAPBOX_TOKEN || import.meta.env.VITE_MAPBOX_TOKEN || ''
    },
    RATE_LIMITS: {
        DEFAULT: {
            maxRequests: parseInt(ENV.RATE_LIMIT_MAX_REQUESTS) || 50,
            timeWindow: parseInt(ENV.RATE_LIMIT_TIME_WINDOW) || 60 * 1000, // 1 minute
        },
        PREMIUM: {
            maxRequests: parseInt(ENV.RATE_LIMIT_PREMIUM_MAX_REQUESTS) || 100,
            timeWindow: parseInt(ENV.RATE_LIMIT_TIME_WINDOW) || 60 * 1000,
        }
    }
};

// Get API configuration
function getApiConfig() {
    return {
        ...API_CONFIG,
    };
}

export { API_CONFIG, getApiConfig }; 