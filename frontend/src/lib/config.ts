// frontend/src/lib/config.ts
// Centralized configuration with fallback values for development

export const API_CONFIG = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
} as const;

// Helper to get API URL
export const getApiUrl = () => API_CONFIG.apiUrl;

// Helper to get WebSocket URL
export const getWsUrl = () => API_CONFIG.wsUrl;

// Helper to build API endpoint
export const getApiEndpoint = (path: string) => {
  const baseUrl = getApiUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
};
