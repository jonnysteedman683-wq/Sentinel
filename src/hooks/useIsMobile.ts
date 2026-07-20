import { useState, useEffect } from 'react';

/**
 * Detects whether the viewport is mobile-sized (< 768px).
 * Used for responsive layout decisions (bottom nav, simplified headers, etc).
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}
