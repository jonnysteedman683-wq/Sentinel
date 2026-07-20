import { useState, useEffect } from 'react';

export function useAppUIState() {
  const [appView, setAppView] = useState<'landing' | 'dashboard'>('landing');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('onboardingComplete');
    if (!hasCompletedOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('onboardingComplete', 'true');
    setShowOnboarding(false);
  };

  return {
    appView, setAppView,
    theme, setTheme,
    showOnboarding, handleOnboardingComplete
  };
}
