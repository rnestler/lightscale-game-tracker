import type { JSX, ReactNode } from 'react';
import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string | null;
  children: ReactNode;
}): JSX.Element {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-2">
      <aside
        className="relative isolate overflow-hidden text-white"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, color-mix(in oklch, var(--foreground), transparent 70%), color-mix(in oklch, var(--foreground), transparent 80%)), url('/assets/club-background.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative p-6 lg:p-10" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.55)' }}>
          <div className="flex items-center gap-3">
            <img
              src="assets/leaderboard-logo.png"
              alt=""
              className="h-8 w-8 object-contain flex-shrink-0"
            />
            <span className="truncate text-sm font-semibold uppercase tracking-wide">
              GameRank Tracker
            </span>
          </div>
        </div>
      </aside>
      <section className="relative flex min-h-[calc(100vh-5rem)] lg:min-h-screen flex-col">
        <div className="absolute right-3 top-3 z-50 flex items-center gap-2">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background p-0 text-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
            onClick={() => {
              const isDarkMode = document.documentElement.classList.toggle('dark');
              localStorage.setItem('lsai:theme', isDarkMode ? 'dark' : 'light');
              setIsDark(isDarkMode);
            }}
            title="Toggle theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-16 lg:px-12">
          <div className="w-full max-w-md">
            <div className="opacity-0 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                {title}
              </h1>
              {subtitle !== null ? (
                <p className="mt-3 text-sm text-muted-foreground md:text-base">{subtitle}</p>
              ) : null}
            </div>
            <div className="mt-8 opacity-0 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              {children}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
