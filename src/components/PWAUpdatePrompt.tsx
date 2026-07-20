import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export const PWAUpdatePrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(url, registration) {
      console.info('[PWA] Service Worker registered:', url);
      // Check for updates every hour
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] SW registration error:', error);
    },
  });

  const [dismissed, setDismissed] = useState(false);

  const close = () => {
    setDismissed(true);
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  if (dismissed) return null;

  if (needRefresh) {
    return (
      <div className="fixed bottom-20 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-slate-900/95 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-4 shadow-2xl shadow-indigo-500/20 max-w-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/20">
              <RefreshCw className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-200">Update available</div>
              <div className="text-xs text-slate-500 mt-0.5">A new version of Sentinel is ready.</div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => updateServiceWorker(true)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-medium hover:bg-indigo-600 transition-colors"
                >
                  Reload
                </button>
                <button
                  onClick={close}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs font-medium hover:bg-slate-700 transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
            <button onClick={close} className="text-slate-600 hover:text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div className="fixed bottom-20 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-slate-900/95 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-4 shadow-2xl max-w-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <RefreshCw className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-200">Ready for offline</div>
              <div className="text-xs text-slate-500 mt-0.5">Sentinel is now installed and works offline.</div>
            </div>
            <button onClick={close} className="text-slate-600 hover:text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
