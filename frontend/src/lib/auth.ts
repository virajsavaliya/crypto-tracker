// Authentication utility functions
// Session persists for 15 minutes even after closing browser
// Uses localStorage for persistence + activity timestamp tracking
export interface User {
  access_token: string;
  refresh_token?: string;
  first_name: string;
  last_name?: string;
  email: string;
  username?: string;
  mobile_number?: string;
  is_premium_user?: boolean;
  subscription_plan?: string;
}

// Session timeout: 15 minutes in milliseconds (matches backend JWT token lifetime)
const SESSION_TIMEOUT = 15 * 60 * 1000;

/**
 * Update last activity timestamp
 */
export const updateLastActivity = (): void => {
  localStorage.setItem('last_activity', Date.now().toString());
};

/**
 * Check if session is still valid (within 15 minutes of last activity)
 * @returns true if session is valid, false if expired
 */
export const isSessionValid = (): boolean => {
  const lastActivityStr = localStorage.getItem('last_activity');
  if (!lastActivityStr) {
    // No last activity recorded, update it now
    updateLastActivity();
    return true;
  }
  
  const lastActivity = parseInt(lastActivityStr);
  const now = Date.now();
  const timeSinceLastActivity = now - lastActivity;
  
  return timeSinceLastActivity < SESSION_TIMEOUT;
};

/**
 * Save user to localStorage (persists for 15 minutes even after closing browser)
 * Also saves refresh token and updates activity timestamp
 */
export const saveUser = (user: User): void => {
  // Primary storage - persists across browser close for 30 minutes
  localStorage.setItem('user', JSON.stringify(user));
  
  // Update last activity timestamp
  updateLastActivity();
  
  // Backup storage - for token refresh
  if (user.refresh_token) {
    localStorage.setItem('user_refresh', user.refresh_token);
  }
  if (user.email) {
    localStorage.setItem('user_email', user.email);
  }
  
  // Notify other components that user data has been updated
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('userUpdated', { detail: user }));
  }
};

/**
 * Get user from localStorage with validation
 * Checks if session is still valid (within 15 minutes)
 * Works even after closing browser - persists for 15 minutes
 * @returns User object or null if not authenticated or session expired
 */
export const getUser = (): User | null => {
  try {
    // Get user from localStorage (persists across browser close)
    const userStr = localStorage.getItem('user');
    
    if (!userStr) {
      return null;
    }
    
    const user = JSON.parse(userStr);
    
    // Validate required fields
    if (!user.access_token || !user.first_name) {
      console.warn('Invalid user session: missing required fields');
      return null;
    }
    
    // Check if session is still valid (within 15 minutes of last activity)
    if (!isSessionValid()) {
      console.warn('Session expired due to inactivity (15 minutes)');
      // Clear expired session
      logout();
      return null;
    }
    
    // Update last activity on every getUser call
    updateLastActivity();
    
    return user;
  } catch (error) {
    console.error('Failed to parse user session:', error);
    return null;
  }
};

/**
 * Check if user is authenticated
 * @returns true if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return getUser() !== null;
};

/**
 * Logout user and redirect to home page
 */
export const logout = (): void => {
  try {
    // Clear all auth-related data from localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('last_activity');
    localStorage.removeItem('user_refresh');
    localStorage.removeItem('user_email');
    localStorage.removeItem('is_premium_user');
    localStorage.removeItem('user_plan');
    
    // Redirect to home page
    window.location.href = '/';
  } catch (error) {
    console.error('Error during logout:', error);
    // Force redirect anyway
    window.location.href = '/';
  }
};

/**
 * Check if response indicates authentication error
 * @param response Fetch Response object
 * @returns true if auth error (401 or 403)
 */
export const isAuthError = (response: Response): boolean => {
  return response.status === 401 || response.status === 403;
};

/**
 * Make authenticated API request with automatic logout on auth errors
 * @param url API endpoint URL
 * @param options Fetch options
 * @returns Promise with response or null if auth failed
 */
export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response | null> => {
  const user = getUser();
  
  if (!user) {
    console.warn('No authenticated user found, redirecting...');
    logout();
    return null;
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${user.access_token}`,
      },
    });
    
    // Check for authentication errors
    if (isAuthError(response)) {
      console.warn('Session expired or unauthorized, redirecting to home...');
      logout();
      return null;
    }
    
    return response;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

/**
 * Require authentication - redirect if not authenticated
 * Use this at the start of protected pages
 * @returns User object if authenticated, otherwise redirects
 */
export const requireAuth = (): User | null => {
  // Only run on client side
  if (typeof window === 'undefined') {
    return null;
  }
  
  const user = getUser();
  
  if (!user) {
    console.warn('Authentication required, redirecting to home...');
    logout();
    return null;
  }
  
  return user;
};

/**
 * Validate token by making an API call to user endpoint
 * This is useful for checking if the token is still valid before making multiple API calls
 * @returns User data if token is valid, null otherwise
 */
export const validateToken = async (): Promise<any | null> => {
  const user = getUser();
  
  if (!user) {
    return null;
  }
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, {
      headers: {
        'Authorization': `Bearer ${user.access_token}`,
      },
    });
    
    if (isAuthError(response)) {
      console.warn('Token validation failed, session expired');
      logout();
      return null;
    }
    
    if (!response.ok) {
      console.error('Failed to validate token:', response.status);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
};
