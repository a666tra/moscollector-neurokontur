import React, { createContext, useContext, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'light', toggle: () => {} });

const initial = (): Theme => {
  try {
    const saved = localStorage.getItem('nk-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* storage unavailable */ }
  return 'light';
};

/** Light «paper» / dark «ink» theme, stored per browser; applied as data-theme on <html>. */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(initial);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('nk-theme', theme); } catch { /* ignore */ }
  }, [theme]);
  return <ThemeCtx.Provider value={{ theme, toggle: () => setTheme(t => (t === 'light' ? 'dark' : 'light')) }}>{children}</ThemeCtx.Provider>;
};

export const useTheme = () => useContext(ThemeCtx);

export const ThemeButton: React.FC<{ className?: string }> = ({ className = 'icon-btn' }) => {
  const { theme, toggle } = useTheme();
  return (
    <button className={className} onClick={toggle} title="Сменить тему" aria-label="Сменить тему">
      {theme === 'light' ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
    </button>
  );
};
