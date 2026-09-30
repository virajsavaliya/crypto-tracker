// src/lib/useInactivityLogout.ts
// Auto-logout hook for handling user inactivity
// Improved version with better activity detection and warning system

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UseInactivityLogoutOptions {
  timeout?: number; // Timeout in milliseconds (default: 30 minutes)
  warningTime?: number; // Show warning before logout (default: 2 minutes before)
  onLogout?: () => void; // Optional callback before logout
  onWarning?: (remainingSeconds: number) => void; // Optional callback when warning shows
}

export function useInactivityLogout(options: UseInactivityLogoutOptions = {}) {
  const { 
    timeout = 30 * 60 * 1000, // Default 30 minutes
    warningTime = 2 * 60 * 1000, // Warning 2 minutes before logout
    onLogout,
    onWarning 
  } = options;
  
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const [showWarning, setShowWarning] = useState(false);

  const handleLogout = useCallback(() => {
    // Clear user data from localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('last_activity');
    
    // Call optional callback
    if (onLogout) {
      onLogout();
    }

    // Redirect to home page with logout message
    router.push('/?session=expired');
  }, [router, onLogout]);

  const resetTimer = useCallback(() => {
    // Clear existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    // Hide warning if showing
    setShowWarning(false);

    // Update last activity timestamp in localStorage (sync with auth.ts)
    const now = Date.now();
    lastActivityRef.current = now;
    localStorage.setItem('last_activity', now.toString());

    // Set warning timeout (shows before actual logout)
    const warningDelay = timeout - warningTime;
    if (warningDelay > 0) {
      warningTimeoutRef.current = setTimeout(() => {
        console.log('⚠️ User will be logged out soon due to inactivity');
        setShowWarning(true);
        if (onWarning) {
          onWarning(warningTime / 1000); // Pass remaining seconds
        }
      }, warningDelay);
    }

    // Set logout timeout
    timeoutRef.current = setTimeout(() => {
      const inactiveMinutes = Math.round(timeout / 60000);
      console.log(`🔴 User inactive for ${inactiveMinutes} minutes - Auto logout`);
      handleLogout();
    }, timeout);
  }, [timeout, warningTime, handleLogout, onWarning]);

  useEffect(() => {
    // Check if user is logged in
    const user = localStorage.getItem('user');
    if (!user) {
      return; // Don't track if not logged in
    }

    // Enhanced events that indicate user activity
    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'keypress',
      'scroll',
      'touchstart',
      'touchmove',
      'click',
      'focus',
      'blur',
      'wheel',
    ];

    // Throttle the reset timer to avoid too many calls
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledResetTimer = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          resetTimer();
          throttleTimeout = null;
        }, 5000); // Throttle to once per 5 seconds (more generous)
      }
    };

    // Track visibility changes (when user switches tabs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User came back to tab
        console.log('👁️ Tab visible again - checking session validity');
        
        // Check if session is still valid based on last_activity in localStorage
        const lastActivityStr = localStorage.getItem('last_activity');
        if (lastActivityStr) {
          const lastActivity = parseInt(lastActivityStr);
          const timeSinceLastActivity = Date.now() - lastActivity;
          const minutesSinceActivity = Math.round(timeSinceLastActivity / 60000);
          
          console.log(`⏱️ Time since last activity: ${minutesSinceActivity} minutes`);
          
          // If session expired (more than 30 minutes), logout immediately
          if (timeSinceLastActivity >= 30 * 60 * 1000) {
            console.log('🔴 Session expired while tab was inactive - logging out');
            handleLogout();
            return;
          }
        }
        
        // Session still valid, reset timer
        console.log('✅ Session still valid - resetting inactivity timer');
        resetTimer();
      } else {
        console.log('👁️ Tab hidden - timer continues in background');
      }
    };
    
    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, throttledResetTimer, { passive: true });
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initialize timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, throttledResetTimer);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, [resetTimer, handleLogout]);

  // Return function to manually reset timer (useful for API calls)
  return { 
    resetTimer, 
    lastActivity: lastActivityRef.current,
    showWarning,
    dismissWarning: resetTimer // User can dismiss warning by any activity
  };
}
