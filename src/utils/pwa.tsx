import React, { useEffect, useState } from 'react';
import { Download, WifiOff } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        Installed as App
      </span>
    );
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`inline-flex items-center gap-2 bg-[#0078D7] hover:bg-[#106EBE] text-white px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        Install Windows 10 App
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowGuide(true)}
          className={`inline-flex items-center gap-2 border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          Install on iOS
        </button>

        {showGuide && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-5 shadow-2xl">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                Install on iPhone / iPad
              </h3>
              <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                1. Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.<br />
                2. Scroll down and select <strong>Add to Home Screen</strong>.
              </p>
              <button
                onClick={() => setShowGuide(false)}
                className="mt-4 w-full bg-[#0078D7] text-white py-2 text-xs font-medium hover:bg-[#106EBE] cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <button
      onClick={() => setShowGuide(true)}
      className={`inline-flex items-center gap-2 border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${className}`}
    >
      <Download className="w-3.5 h-3.5" />
      Install PWA Guide
      {showGuide && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            setShowGuide(false);
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 text-left"
        >
          <span
            onClick={(e) => e.stopPropagation()}
            className="block w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-5 shadow-2xl whitespace-normal"
          >
            <strong className="block text-sm font-semibold text-neutral-900 dark:text-white">
              Install as Desktop or Mobile App
            </strong>
            <span className="block mt-2 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Use your browser&apos;s address bar install icon or browser menu (&ldquo;Install app&rdquo; / &ldquo;Add to Home Screen&rdquo;) to run this Windows 10 simulator offline in standalone mode.
            </span>
            <span
              onClick={() => setShowGuide(false)}
              className="mt-4 inline-block bg-[#0078D7] text-white px-4 py-1.5 text-xs font-medium hover:bg-[#106EBE] cursor-pointer"
            >
              Close
            </span>
          </span>
        </span>
      )}
    </button>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9995] flex items-center gap-2 bg-amber-600/95 text-white px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-md">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline Mode — Cached local storage active</span>
    </div>
  );
};
