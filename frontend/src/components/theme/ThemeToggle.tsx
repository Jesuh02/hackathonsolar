'use client';

import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      aria-label={`Cambiar a tema ${isDark ? 'claro' : 'oscuro'}`}
      className="
        relative inline-flex items-center w-[60px] h-[32px] rounded-full
        border border-[var(--border)] bg-[var(--surface-2)]
        transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
        hover:scale-[1.03] active:scale-[0.97] overflow-hidden
        shadow-[0_1px_3px_rgba(0,0,0,0.08)]
      "
    >
      <span
        className="
          absolute top-[2px] flex items-center justify-center
          w-[26px] h-[26px] rounded-full
          bg-gradient-to-br from-white to-slate-100
          dark:from-slate-200 dark:to-slate-300
          shadow-md transition-all duration-500
          ease-[cubic-bezier(0.16,1,0.3,1)]
        "
        style={{
          left: isDark ? '2px' : 'calc(100% - 28px)',
          transform: isDark ? 'rotate(0deg)' : 'rotate(360deg)',
        }}
      >
        {isDark ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        )}
      </span>
    </button>
  );
}
