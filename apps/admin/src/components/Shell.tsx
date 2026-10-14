'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { Activity, Bus, LogOut, Receipt, Users } from 'lucide-react';
import { useSession } from '@/lib/session';

const NAV = [
  { href: '/', label: 'Live ops', icon: Activity },
  { href: '/drivers', label: 'Drivers & shifts', icon: Users },
  { href: '/trips', label: 'Trips & refunds', icon: Receipt },
];

export function Shell({ children, title, right }: { children: ReactNode; title: string; right?: ReactNode }) {
  const pathname = usePathname();
  const { session, signOut } = useSession();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="flex items-center gap-2 border-b border-line bg-panel px-4 py-3 lg:sticky lg:top-0 lg:h-screen lg:flex-col lg:items-stretch lg:gap-1 lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
        <div className="mr-4 flex items-center gap-3 lg:mb-8 lg:mr-0 lg:px-2">
          <div className="grid size-9 place-items-center rounded-xl bg-brand-yellow">
            <Bus className="size-5 text-brand-yellow-ink" aria-hidden />
          </div>
          <div className="hidden sm:block">
            <p className="text-[15px] font-extrabold tracking-tight">RidesRus</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-lime">Fleet HQ</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active ? 'bg-panel-2 text-ink' : 'text-ink-muted hover:bg-panel-2/60 hover:text-ink'
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto lg:mt-auto lg:ml-0 lg:border-t lg:border-line lg:pt-4">
          <p className="hidden px-3 text-xs text-ink-muted lg:block">{session?.admin.email}</p>
          <button onClick={signOut} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink-muted hover:text-ink">
            <LogOut className="size-4" aria-hidden /> <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          {right}
        </header>
        {children}
      </main>
    </div>
  );
}

export function Panel({ title, children, right, className = '' }: { title?: string; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-panel ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-ink-muted">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
