import React from 'react';
import { OSProvider, useOS } from './context/OSContext';
import { BootScreen } from './components/shell/BootScreen';
import { LockScreen } from './components/shell/LockScreen';
import { LoginScreen } from './components/shell/LoginScreen';
import { PowerOverlay } from './components/shell/PowerOverlay';
import { Desktop } from './components/shell/Desktop';
import { WindowFrame } from './components/shell/WindowFrame';
import { Taskbar } from './components/shell/Taskbar';
import { StartMenu } from './components/shell/StartMenu';
import { ActionCenter } from './components/shell/ActionCenter';
import { DesktopFlyouts } from './components/shell/DesktopFlyouts';
import { TaskSwitcher } from './components/shell/TaskSwitcher';
import { AppRenderer } from './components/apps/AppRenderer';
import { SnippingOverlay } from './components/apps/SnippingToolApp';
import { VirtualMouseOverlay } from './components/shell/VirtualMouseOverlay';
import { OfflineIndicator } from './utils/pwa';

const Windows10Shell: React.FC = () => {
  const { powerPhase, windows, settings } = useOS();

  return (
    <div className="relative w-dvw h-dvh overflow-hidden">
      {/* Power Lifecycle Screens */}
      {powerPhase === 'boot' && <BootScreen />}
      {powerPhase === 'lock' && <LockScreen />}
      {powerPhase === 'login' && <LoginScreen />}
      {(powerPhase === 'sleeping' || powerPhase === 'restarting' || powerPhase === 'shutdown') && (
        <PowerOverlay />
      )}

      {/* Active Desktop Session */}
      {powerPhase === 'desktop' && (
        <Desktop>
          {windows.map((win) => (
            <WindowFrame key={win.instanceId} win={win}>
              <AppRenderer win={win} />
            </WindowFrame>
          ))}
          <StartMenu />
          <ActionCenter />
          <DesktopFlyouts />
          <TaskSwitcher />
          <Taskbar />
          <SnippingOverlay />
          <VirtualMouseOverlay />
        </Desktop>
      )}

      {/* Global Brightness Dimming & Night Light Filter Overlays */}
      {settings.brightness < 100 && (
        <div
          style={{ opacity: (100 - settings.brightness) / 100 }}
          className="pointer-events-none fixed inset-0 z-[9998] bg-black transition-opacity duration-150"
        />
      )}
      {settings.nightLight && (
        <div
          style={{ opacity: settings.nightLightStrength / 100 }}
          className="pointer-events-none fixed inset-0 z-[9999] bg-amber-500/45 mix-blend-multiply transition-opacity duration-300"
        />
      )}

      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <OSProvider>
      <Windows10Shell />
    </OSProvider>
  );
}
