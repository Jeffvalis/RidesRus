'use client';

import { FormEvent, useState } from 'react';
import { KeyRound, Plus, X } from 'lucide-react';
import { AdminBusDTO, AdminDriverDTO, ApiError, CreateDriverBody, IssuedShiftKeyDTO } from '@ridesrus/core';
import { Panel, Shell } from '@/components/Shell';
import { usePolling } from '@/lib/live';
import { useSession } from '@/lib/session';

export default function Drivers() {
  const { api } = useSession();
  const drivers = usePolling<AdminDriverDTO[]>('/admin/drivers', 10_000);
  const buses = usePolling<AdminBusDTO[]>('/admin/buses', 10_000);
  const [keyFor, setKeyFor] = useState<AdminDriverDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const endShift = async (d: AdminDriverDTO) => {
    if (!d.shiftId || !confirm(`End ${d.name}'s shift on ${d.busCode}? Their tablet will sign out.`)) return;
    try {
      await api.post(`/admin/shifts/${d.shiftId}/end`);
      drivers.reload();
      buses.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not end the shift.');
    }
  };

  return (
    <Shell title="Drivers & shifts">
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Panel title="Drivers" className="overflow-x-auto">
          {error && <p role="alert" className="m-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm font-semibold text-brand-red">{error}</p>}
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-widest text-ink-muted">
              <tr>
                <th className="px-5 py-3 font-bold">Driver</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 font-bold">Trips today</th>
                <th className="px-5 py-3 font-bold">Rating</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {drivers.data?.map((d) => (
                <tr key={d.id}>
                  <td className="px-5 py-3">
                    <p className="font-bold text-ink">{d.name}</p>
                    <p className="font-mono text-xs text-ink-muted">
                      {d.code} · {d.phone}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    {d.onShift ? (
                      <span className="rounded-full bg-brand-green/15 px-2.5 py-1 text-xs font-bold text-brand-lime">On {d.busCode}</span>
                    ) : (
                      <span className="rounded-full bg-panel-2 px-2.5 py-1 text-xs font-bold text-ink-muted">Off shift</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-ink-soft">{d.tripsToday}</td>
                  <td className="px-5 py-3 text-ink-soft">{d.avgRating ? `${d.avgRating.toFixed(2)} ★` : '—'}</td>
                  <td className="px-5 py-3 text-right">
                    {d.onShift ? (
                      <button onClick={() => endShift(d)} className="rounded-lg px-3 py-2 text-xs font-bold text-brand-red hover:bg-brand-red/10">
                        End shift
                      </button>
                    ) : (
                      <button onClick={() => setKeyFor(d)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-yellow px-3 py-2 text-xs font-extrabold text-brand-yellow-ink hover:brightness-95">
                        <KeyRound className="size-3.5" aria-hidden /> Issue key
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <EnrollDriver onCreated={drivers.reload} />
      </div>
      {keyFor && <IssueKey driver={keyFor} buses={buses.data ?? []} onClose={() => (setKeyFor(null), drivers.reload())} />}
    </Shell>
  );
}

function EnrollDriver({ onCreated }: { onCreated: () => void }) {
  const { api } = useSession();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [created, setCreated] = useState<AdminDriverDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = CreateDriverBody.safeParse({ name, phone });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(null);
    try {
      setCreated(await api.post<AdminDriverDTO>('/admin/drivers', parsed.data));
      setName('');
      setPhone('');
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not enrol driver.');
    }
  };

  return (
    <Panel title="Enrol a driver">
      <form onSubmit={submit} className="space-y-4 p-5">
        <Input label="Full name" value={name} onChange={setName} autoComplete="name" />
        <Input label="Phone" value={phone} onChange={setPhone} placeholder="+234 803 000 0000" autoComplete="tel" />
        {error && <p role="alert" className="text-sm font-semibold text-brand-red">{error}</p>}
        {created && (
          <p className="rounded-xl bg-brand-green/10 px-4 py-3 text-sm text-brand-lime">
            Enrolled <b>{created.name}</b> with permanent ID <b className="font-mono">{created.code}</b>.
          </p>
        )}
        <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 font-extrabold text-bg hover:brightness-95">
          <Plus className="size-4" aria-hidden /> Enrol driver
        </button>
      </form>
    </Panel>
  );
}

function IssueKey({ driver, buses, onClose }: { driver: AdminDriverDTO; buses: AdminBusDTO[]; onClose: () => void }) {
  const { api } = useSession();
  const free = buses.filter((b) => !b.onShiftDriver);
  const [busId, setBusId] = useState(free[0]?.id ?? '');
  const [issued, setIssued] = useState<IssuedShiftKeyDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const issue = async () => {
    setError(null);
    try {
      setIssued(await api.post<IssuedShiftKeyDTO>(`/admin/drivers/${driver.id}/shift-keys`, { busId }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not issue a key.');
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="issue-title">
      <div className="relative w-full max-w-md rounded-3xl border border-line bg-panel p-7">
        <button onClick={onClose} className="absolute right-5 top-5 text-ink-muted hover:text-ink" aria-label="Close">
          <X className="size-5" />
        </button>
        <h2 id="issue-title" className="text-xl font-extrabold">
          Shift key for {driver.name}
        </h2>
        {issued ? (
          <div className="mt-6 space-y-4 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">Read this to the driver · shown once</p>
            <p className="font-mono text-5xl font-extrabold tracking-[0.25em] text-ink">{issued.pin}</p>
            <p className="text-sm text-ink-soft">
              {issued.driverCode} signs in on <b>{issued.busCode}</b> with this key before{' '}
              {new Date(issued.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. It works once.
            </p>
            <button onClick={onClose} className="w-full rounded-xl bg-ink py-3 font-extrabold text-bg">
              Done
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-ink-soft">The key is bound to one bus, works once and expires in 15 minutes. Issuing a new key cancels older ones.</p>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">Bus</span>
              <select value={busId} onChange={(e) => setBusId(e.target.value)} className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-ink">
                {buses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.plate} {b.onShiftDriver ? `(on shift: ${b.onShiftDriver})` : ''}
                  </option>
                ))}
              </select>
            </label>
            {error && <p role="alert" className="text-sm font-semibold text-brand-red">{error}</p>}
            <button onClick={issue} disabled={!busId} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-yellow py-3 font-extrabold text-brand-yellow-ink disabled:opacity-50">
              <KeyRound className="size-4" aria-hidden /> Generate key
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, autoComplete }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-ink outline-none placeholder:text-ink-muted/60 focus:border-brand-yellow" />
    </label>
  );
}
