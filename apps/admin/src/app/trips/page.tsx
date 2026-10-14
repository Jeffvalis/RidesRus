'use client';

import { useState } from 'react';
import { AdminTripDTO, ApiError, formatAgo, formatNaira } from '@ridesrus/core';
import { Panel, Shell } from '@/components/Shell';
import { usePolling } from '@/lib/live';
import { useSession } from '@/lib/session';

const STATUS: Record<AdminTripDTO['status'], string> = {
  BOARDED: 'bg-brand-blue/15 text-brand-blue',
  COMPLETED: 'bg-brand-green/15 text-brand-lime',
  VOIDED: 'bg-brand-red/15 text-brand-red',
};

export default function Trips() {
  const { api } = useSession();
  const trips = usePolling<AdminTripDTO[]>('/admin/trips', 8_000);
  const [error, setError] = useState<string | null>(null);

  const voidTrip = async (t: AdminTripDTO) => {
    if (!confirm(`Void ${t.passengerName}'s trip on ${t.busCode} and refund ${formatNaira(t.fareKobo)}?`)) return;
    setError(null);
    try {
      await api.post(`/admin/trips/${t.id}/void`);
      trips.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not void the trip.');
    }
  };

  return (
    <Shell title="Trips & refunds">
      <Panel title="Latest 50 trips" className="overflow-x-auto">
        {error && <p role="alert" className="m-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm font-semibold text-brand-red">{error}</p>}
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-widest text-ink-muted">
            <tr>
              <th className="px-5 py-3 font-bold">Rider</th>
              <th className="px-5 py-3 font-bold">Bus · driver</th>
              <th className="px-5 py-3 font-bold">From → to</th>
              <th className="px-5 py-3 font-bold">Fare</th>
              <th className="px-5 py-3 font-bold">Rating</th>
              <th className="px-5 py-3 font-bold">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {trips.data?.map((t) => (
              <tr key={t.id}>
                <td className="px-5 py-3">
                  <p className="font-semibold text-ink">{t.passengerName}</p>
                  <p className="text-xs text-ink-muted">{formatAgo(t.boardedAt)}</p>
                </td>
                <td className="px-5 py-3 text-ink-soft">
                  {t.busCode} <span className="text-ink-muted">· {t.driverName ?? 'autopilot'}</span>
                </td>
                <td className="px-5 py-3 text-ink-soft">
                  {t.boardStopName ?? '—'} → {t.dropoffStopName ?? <span className="text-brand-yellow">not chosen</span>}
                </td>
                <td className="px-5 py-3 font-semibold text-ink">{formatNaira(t.fareKobo)}</td>
                <td className="px-5 py-3 text-brand-yellow">{t.rating ? '★'.repeat(t.rating) : <span className="text-ink-muted">—</span>}</td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS[t.status]}`}>{t.status.toLowerCase()}</span>
                </td>
                <td className="px-5 py-3 text-right">
                  {t.status !== 'VOIDED' && (
                    <button onClick={() => voidTrip(t)} className="rounded-lg px-3 py-2 text-xs font-bold text-brand-red hover:bg-brand-red/10">
                      Void & refund
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {trips.data?.length === 0 && <p className="px-5 py-6 text-sm text-ink-muted">No trips yet.</p>}
      </Panel>
    </Shell>
  );
}
