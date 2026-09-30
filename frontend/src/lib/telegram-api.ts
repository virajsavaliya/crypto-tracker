/**
 * Telegram API Service
 * Handles all Telegram bot integration API calls
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface TelegramSetupResponse {
  success: boolean;
  setup_token?: string;
  bot_link?: string;
  bot_username?: string;
  instructions?: string[];
  error?: string;
}

export interface TelegramStatusResponse {
  connected: boolean;
  chat_id?: string;
  username?: string;
  bot_username: string;
}

export interface TelegramBotInfoResponse {
  success: boolean;
  bot_username?: string;
  bot_name?: string;
  is_online?: boolean;
  error?: string;
}

/**
 * Get authentication headers with token
 */
const getAuthHeaders = (token?: string) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const authToken = token || user.access_token;
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };
};

/**
 * Check if user is authenticated
 */
const isAuthenticated = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return !!user.access_token;
  } catch (err) {
    return false;
  }
};

/**
 * Refresh the access token using the refresh token
 */
const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.refresh_token) {
      return null;
    }

    const response = await fetch(`${API_URL}/api/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: user.refresh_token }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const updatedUser = { ...user, access_token: data.access };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    
    // Notify other components that user data has been updated
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('userUpdated', { detail: updatedUser }));
    }
    
    return data.access;
  } catch (err) {
    return null;
  }
};

/**
 * Generate a new Telegram setup token and bot link
 */
export async function generateTelegramSetupToken(): Promise<TelegramSetupResponse> {
  try {
    // Check if user is authenticated
    if (!isAuthenticated()) {
      return {
        success: false,
        error: 'Please log in to connect Telegram',
      };
    }

    
    let response = await fetch(`${API_URL}/api/telegram/setup-token/`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });


    // If unauthorized, try to refresh token and retry once
    if (response.status === 401) {
      const newToken = await refreshAccessToken();
      
      if (newToken) {
        response = await fetch(`${API_URL}/api/telegram/setup-token/`, {
          method: 'POST',
          headers: getAuthHeaders(newToken),
        });
      } else {
        return {
          success: false,
          error: 'Session expired. Please log in again.',
        };
      }
    }

    if (!response.ok) {
      // Handle 401 separately (token expired)
      if (response.status === 401) {
        return {
          success: false,
          error: 'Session expired. Please log in again.',
        };
      }
      
      // For 403 and others, try to get server-provided error message
      let errorMessage = `Failed to generate setup token (Status: ${response.status})`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.detail || errorMessage;
      } catch (err) {
        const errorText = await response.text().catch(() => '');
        if (errorText) errorMessage += ` - ${errorText.substring(0, 100)}`;
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error or server unavailable',
    };
  }
}

/**
 * Check Telegram connection status
 */
export async function getTelegramStatus(): Promise<TelegramStatusResponse | null> {
  try {
    // Check if user is authenticated
    if (!isAuthenticated()) {
      return {
        connected: false,
        bot_username: 'volusignal_alerts_v2_bot'
      };
    }

    const response = await fetch(`${API_URL}/api/telegram/status/`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      // Return default disconnected state instead of throwing
      return {
        connected: false,
        bot_username: 'volusignal_alerts_v2_bot'
      };
    }

    return await response.json();
  } catch (err) {
    // Return default disconnected state on error
    return {
      connected: false,
      bot_username: 'volusignal_alerts_v2_bot'
    };
  }
}

/**
 * Disconnect Telegram account
 */
export async function disconnectTelegram(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // Check if user is authenticated
    if (!isAuthenticated()) {
      return {
        success: false,
        error: 'Please log in to disconnect Telegram',
      };
    }

    const response = await fetch(`${API_URL}/api/telegram/disconnect/`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to disconnect Telegram');
    }

    return await response.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Send a test alert to Telegram
 */
export async function sendTestTelegramAlert(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // Check if user is authenticated
    if (!isAuthenticated()) {
      return {
        success: false,
        error: 'Please log in to send test alerts',
      };
    }

    const response = await fetch(`${API_URL}/api/telegram/test-alert/`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to send test alert');
    }

    return await response.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get Telegram bot information (public endpoint)
 */
export async function getTelegramBotInfo(): Promise<TelegramBotInfoResponse> {
  try {
    const response = await fetch(`${API_URL}/api/telegram/bot-info/`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to get bot info');
    }

    return await response.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get user alert settings
 */
export async function getUserAlertSettings(): Promise<unknown> {
  try {
    const response = await fetch(`${API_URL}/api/alert-settings/`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to get alert settings');
    }

    return await response.json();
  } catch (err) {
    return null;
  }
}
