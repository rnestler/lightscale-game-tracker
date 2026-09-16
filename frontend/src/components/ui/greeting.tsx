import type { JSX } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface GreetingProps {
  title: string;
}

function greetingFor(hour: number): string {
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 18) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

export function Greeting({ title }: GreetingProps): JSX.Element {
  const { user } = useAuth();
  const now = new Date();
  const [firstName = ''] = (user?.name ?? '').trim().split(/\s+/);
  const date = now.toLocaleDateString('en', { dateStyle: 'long' });
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-2xl font-semibold tracking-tight">
        {greetingFor(now.getHours())}
        {firstName === '' ? '' : `, ${firstName}`}
      </h2>
      <p className="text-sm text-muted-foreground">{`Here's what's happening at ${title} today, ${date}.`}</p>
    </div>
  );
}
