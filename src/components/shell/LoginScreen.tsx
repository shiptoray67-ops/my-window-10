import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Power, RotateCcw, Moon, Volume2, VolumeX, Wifi } from 'lucide-react';
import { useOS } from '../../context/OSContext';
import { soundEngine } from '../../utils/sound';

export const LoginScreen: React.FC = () => {
  const { settings, updateSettings, setPowerPhase, triggerPowerAction } = useOS();
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [powerMenuOpen, setPowerMenuOpen] = useState(false);

  const hasPassword = settings.password.trim().length > 0;

  const handleSignIn = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (hasPassword && passwordInput !== settings.password) {
      soundEngine.playError();
      setErrorMsg('The password is incorrect. Try again.');
      return;
    }
    setErrorMsg('');
    setSigningIn(true);
    soundEngine.playStartup();
    setTimeout(() => {
      setPowerPhase('desktop');
    }, 650);
  };

  const isGradient = settings.lockWallpaper.startsWith('linear-gradient');

  return (
    <div
      onClick={() => setPowerMenuOpen(false)}
      className="fixed inset-0 z-[9980] flex flex-col items-center justify-center text-white overflow-hidden"
    >
      {/* Blurred wallpaper backdrop */}
      <div
        style={
          isGradient
            ? { background: settings.lockWallpaper }
            : {
                backgroundImage: `url(${settings.lockWallpaper})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
        }
        className="absolute inset-0 scale-105 blur-2xl brightness-50"
      />
      <div className="absolute inset-0 bg-black/30" />

      {/* Center User Card */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-6">
        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 border-white/30 shadow-2xl bg-neutral-800 mb-3 sm:mb-5">
          <img
            src={settings.avatarUrl}
            alt={settings.username}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>

        <h1 className="text-xl sm:text-3xl font-normal tracking-tight text-white mb-0.5 sm:mb-1">
          {settings.username}
        </h1>
        <p className="text-xs text-white/70 mb-4 sm:mb-6">{settings.userTitle}</p>

        {signingIn ? (
          <div className="flex flex-col items-center gap-3 py-3">
            <div className="relative w-7 h-7">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="win10-loader-dot"
                  style={{ animationDelay: `${i * 0.16}s` }}
                />
              ))}
            </div>
            <span className="text-sm text-white/90">Welcome</span>
          </div>
        ) : hasPassword ? (
          <form onSubmit={handleSignIn} className="w-full max-w-[280px] space-y-3">
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Password"
                autoFocus
                className="w-full h-10 bg-black/50 border border-white/40 focus:border-white px-3 pr-16 text-sm text-white placeholder:text-white/60 outline-none backdrop-blur-md"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-10 p-1.5 text-white/70 hover:text-white cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                type="submit"
                className="absolute right-0 h-10 w-10 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
                title="Sign in"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {errorMsg && (
              <p className="text-xs text-rose-300 text-center">{errorMsg}</p>
            )}
            {settings.passwordHint && (
              <p className="text-xs text-white/65 text-center">
                Password hint: {settings.passwordHint}
              </p>
            )}
          </form>
        ) : (
          <button
            onClick={() => handleSignIn()}
            className="px-10 py-2.5 bg-white/20 hover:bg-white/30 border border-white/35 text-sm font-medium text-white backdrop-blur-md transition-colors cursor-pointer"
          >
            Sign in
          </button>
        )}
      </div>

      {/* Bottom Right Quick Controls */}
      <div className="absolute bottom-6 right-6 z-20 flex items-center gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateSettings({ wifiEnabled: !settings.wifiEnabled });
          }}
          className="p-2.5 hover:bg-white/15 rounded-sm transition-colors cursor-pointer"
          title={settings.wifiEnabled ? 'Wi-Fi Connected' : 'Wi-Fi Disconnected'}
        >
          <Wifi className={`w-5 h-5 ${settings.wifiEnabled ? 'text-white' : 'text-white/40'}`} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateSettings({ muted: !settings.muted });
          }}
          className="p-2.5 hover:bg-white/15 rounded-sm transition-colors cursor-pointer"
          title={settings.muted ? 'Unmute audio' : 'Mute audio'}
        >
          {settings.muted ? <VolumeX className="w-5 h-5 text-white/60" /> : <Volume2 className="w-5 h-5 text-white" />}
        </button>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPowerMenuOpen((o) => !o);
            }}
            className="p-2.5 hover:bg-white/15 rounded-sm transition-colors cursor-pointer"
            title="Power"
          >
            <Power className="w-5 h-5" />
          </button>

          {powerMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-12 right-0 w-44 bg-neutral-900/95 border border-white/15 shadow-2xl py-1 backdrop-blur-xl text-sm"
            >
              <button
                onClick={() => triggerPowerAction('sleep')}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-left cursor-pointer"
              >
                <Moon className="w-4 h-4" /> Sleep
              </button>
              <button
                onClick={() => triggerPowerAction('shutdown')}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-left cursor-pointer"
              >
                <Power className="w-4 h-4" /> Shut down
              </button>
              <button
                onClick={() => triggerPowerAction('restart')}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-left cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Restart
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Left Back to Lock Screen */}
      <button
        onClick={() => setPowerPhase('lock')}
        className="absolute bottom-6 left-6 z-20 px-3 py-1.5 text-xs text-white/75 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      >
        Lock screen
      </button>
    </div>
  );
};
