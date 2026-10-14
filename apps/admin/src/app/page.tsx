'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CircleDot, Radio } from 'lucide-react';
import { ActivityDTO, AdminOverviewDTO, BusLiveDTO, RouteDTO, formatAgo, formatEta, formatNaira } from '@ridesrus/core';
import { Panel, Shell } from '@/components/Shell';
import { useLiveOps, usePolling } from '@/lib/live';
import { useSession } from '@/lib/session';

const FleetMap = dynamic(() => import('@/components/FleetMap'), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-ink-muted">Loading map…</div>,
});

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

export default function LiveOps() {
  const { api } = useSession();
  const { buses, activity, connected } = useLiveOps();
  const { data: overview } = usePolling<AdminOverviewDTO>('/admin/overview', 5_000);
  const [route, setRoute] = useState<RouteDTO | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    api.get<RouteDTO[]>('/routes').then((r) => setRoute(r[0] ?? null)).catch(() => undefined);
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, [api]);

  // SOS alerts stay pinned for 15 minutes.
  const sos = useMemo(() => activity.filter((a) => a.type === 'SOS' && now - a.at < 15 * 60_000), [activity, now]);
  const stopName = (id: string | null) => route?.stops.find((s) => s.id === id)?.name ?? '—';
  const t = overview?.today;

  return (
    <Shell
      title="Live operations"
      right={
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${connected ? 'bg-brand-green/15 text-brand-lime' : 'bg-brand-red/15 text-brand-red'}`}>
          <Radio className={`size-3.5 ${connected ? 'animate-pulse' : ''}`} aria-hidden /> {connected ? 'Live' : 'Reconnecting…'}
        </span>
      }
    >
      {sos.map((a) => (
        <div key={a.id} role="alert" className="mb-4 flex items-center gap-3 rounded-2xl border border-brand-red/50 bg-brand-red/10 px-5 py-4">
          <AlertTriangle className="size-6 shrink-0 text-brand-red" aria-hidden />
          <p className="font-bold text-ink">{a.message}</p>
          <span className="ml-auto text-sm text-ink-muted">{formatAgo(a.at, now)}</span>
        </div>
      ))}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Buses in service" value={overview ? `${overview.busesInService}/${overview.busesTotal}` : '—'} />
        <Kpi label="Riders on board" value={overview ? String(overview.passengersOnboard) : '—'} sub={overview ? `${pct(overview.passengersOnboard / overview.seatsTotal)} of seats` : undefined} />
        <Kpi label="Fares today" value={t ? formatNaira(t.fareVolumeKobo) : '—'} sub={t ? `${t.boardings} boardings` : undefined} />
        <Kpi label="Hail → board" value={pct(t?.hailConversion ?? null)} sub="PRD target 85%" good={t?.hailConversion != null ? t.hailConversion >= 0.85 : undefined} />
        <Kpi label="Stop chosen" value={pct(t?.dropoffSelectionRate ?? null)} sub="PRD target 90%" good={t?.dropoffSelectionRate != null ? t.dropoffSelectionRate >= 0.9 : undefined} />
        <Kpi label="Avg rating" value={t?.avgRating != null ? t.avgRating.toFixed(2) : '—'} sub={t ? `${t.ratingsCount} ratings · target 4.2` : undefined} good={t?.avgRating != null ? t.avgRating >= 4.2 : undefined} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel className="h-[440px] overflow-hidden">
          <FleetMap route={route} buses={buses} alertBusCodes={sos.map((a) => a.busCode ?? '')} />
        </Panel>
        <Panel title="Activity" right={<span className="text-xs text-ink-muted">{activity.length} events</span>} className="flex h-[440px] flex-col">
          <ol className="flex-1 divide-y divide-line overflow-y-auto" aria-live="polite">
            {activity.length === 0 && <li className="px-5 py-6 text-sm text-ink-muted">Waiting for activity…</li>}
            {activity.map((a) => (
              <ActivityRow key={a.id} a={a} now={now} />
            ))}
          </ol>
        </Panel>
      </div>

      <Panel title="Fleet" className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-widest text-ink-muted">
            <tr>
              <th className="px-5 py-3 font-bold">Bus</th>
              <th className="px-5 py-3 font-bold">Load</th>
              <th className="px-5 py-3 font-bold">Heading</th>
              <th className="px-5 py-3 font-bold">Next stop</th>
              <th className="px-5 py-3 font-bold">Source</th>
              <th className="px-5 py-3 font-bold">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {[...buses].sort((a, b) => a.code.localeCompare(b.code)).map((b) => (
              <BusRow key={b.id} b={b} next={stopName(b.nextStopId)} now={now} />
            ))}
          </tbody>
        </table>
        {buses.length === 0 && <p className="px-5 py-6 text-sm text-ink-muted">No buses reporting.</p>}
      </Panel>
    </Shell>
  );
}

function Kpi({ label, value, sub, good }: { label: string; value: string; sub?: string; good?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">{label}</p>
      <p className={`mt-2 text-2xl font-extrabold tracking-tight ${good === undefined ? 'text-ink' : good ? 'text-brand-lime' : 'text-brand-yellow'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}

const TYPE_STYLE: Record<ActivityDTO['type'], string> = {
  HAIL: 'text-brand-yellow',
  BOARD: 'text-brand-lime',
  DROPOFF: 'text-brand-blue',
  RATING: 'text-brand-yellow',
  TOPUP: 'text-brand-green',
  SHIFT: 'text-ink-soft',
  VOID: 'text-brand-red',
  SOS: 'text-brand-red',
};

function ActivityRow({ a, now }: { a: ActivityDTO; now: number }) {
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <CircleDot className={`mt-0.5 size-4 shrink-0 ${TYPE_STYLE[a.type]}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{a.message}</p>
        <p className="text-xs text-ink-muted">
          {a.type.toLowerCase()} · {formatAgo(a.at, now)}
        </p>
      </div>
    </li>
  );
}

function BusRow({ b, next, now }: { b: BusLiveDTO; next: string; now: number }) {
  const load = b.occupied / b.capacity;
  const bar = b.band === 'FULL' ? 'bg-brand-red' : load > 0.6 ? 'bg-brand-yellow' : 'bg-brand-green';
  return (
    <tr>
      <td className="px-5 py-3">
        <p className="font-bold text-ink">{b.code}</p>
        <p className="font-mono text-xs text-ink-muted">{b.plate}</p>
      </td>
      <td className="w-56 px-5 py-3">
        <div className="mb-1 flex justify-between text-xs">
          <span className="font-bold text-ink-soft">
            {b.occupied}/{b.capacity}
          </span>
          <span className="text-ink-muted">{b.band.toLowerCase()}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
          <div className={`h-full rounded-full ${bar} transition-all`} style={{ width: `${load * 100}%` }} />
        </div>
      </td>
      <td className="px-5 py-3 text-ink-soft">{b.direction === 'EASTBOUND' ? '→ Ajah' : '→ Victoria Island'}</td>
      <td className="px-5 py-3 text-ink-soft">
        {next} <span className="text-ink-muted">· {formatEta(b.nextStopEtaSec)}</span>
      </td>
      <td className="px-5 py-3">
        <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${b.source === 'GPS' ? 'bg-brand-green/15 text-brand-lime' : 'bg-panel-2 text-ink-muted'}`}>
          {b.source === 'GPS' ? 'Tablet GPS' : 'Autopilot'}
        </span>
      </td>
      <td className="px-5 py-3 text-xs text-ink-muted">{formatAgo(b.updatedAt, now)}</td>
    </tr>
  );
}
