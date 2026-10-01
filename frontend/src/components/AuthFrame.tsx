import { i18n } from '../i18n/text';
import type { JSX, ReactNode } from 'react';
import { useState } from 'react';
import { MoonIcon, SunIcon } from 'lucide-react';

export function AuthFrame({
  screenTitle,
  screenSubtitle,
  children,
}: {
  screenTitle: string;
  screenSubtitle: string;
  children: ReactNode;
}): JSX.Element {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  return (
    <div className="min-h-screen bg-background ui-page-backdrop isolate text-foreground">
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          backgroundImage: "url('/assets/club-background.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 -z-10 bg-white/40 dark:bg-black/40 pointer-events-none"
        aria-hidden="true"
      />
      <section className="relative flex min-h-screen flex-col">
        <div className="absolute right-3 top-3 z-50 flex items-center gap-2">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background p-0 text-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
            onClick={() => {
              const isDarkMode = document.documentElement.classList.toggle('dark');
              localStorage.setItem('lsai:theme', isDarkMode ? 'dark' : 'light');
              setIsDark(isDarkMode);
            }}
            title={i18n.chrome.toggleTheme}
          >
            {isDark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-16 lg:px-12">
          <div className="w-full max-w-md">
            <div className="flex items-center gap-3 mb-10">
              <img
                src="assets/leaderboard-logo.png"
                alt=""
                className="h-8 w-8 object-contain flex-shrink-0"
              />
              <span className="truncate text-sm font-semibold uppercase tracking-wide">
                {i18n.word("'GameRank Tracker'")}
              </span>
            </div>
            <div className="rounded-2xl border border-border bg-card p-8 shadow-sm md:p-10">
              <div className="opacity-0 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  {screenTitle}
                </h1>
                {screenSubtitle !== '' ? (
                  <p className="mt-3 text-sm text-muted-foreground md:text-base">
                    {screenSubtitle}
                  </p>
                ) : null}
              </div>
              <div className="mt-8 opacity-0 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                {children}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
