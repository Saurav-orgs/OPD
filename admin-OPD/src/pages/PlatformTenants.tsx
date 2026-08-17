import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '../api/endpoints';
import { useToast } from '../components/Toast';
import { Empty, Loading } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { Navigate } from 'react-router-dom';

export default function PlatformTenants() {
  const { user } = useAuth();
  if (user?.type !== 'super_admin') return <Navigate to="/" replace />;

  return <TenantList />;
}

function TenantList() {
  const toast = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({ queryKey: ['platform-tenants'], queryFn: platformApi.listTenants });
  const statsQ = useQuery({ queryKey: ['platform-stats'], queryFn: platformApi.stats });

  const suspend = useMutation({
    mutationFn: (id: string) => platformApi.suspend(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-tenants'] }); toast.success('Practice suspended'); },
    onError: (e) => toast.error(e),
  });

  const reactivate = useMutation({
    mutationFn: (id: string) => platformApi.reactivate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-tenants'] }); toast.success('Practice reactivated'); },
    onError: (e) => toast.error(e),
  });

  if (isLoading) return <Loading />;
  if (error) return <Empty>Could not load tenants.</Empty>;

  const rows = (data ?? []).filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.includes(search.toLowerCase())
  );

  return (
    <>
      <div className="hero">
        <h1>All practices</h1>
        <p>Platform view — manage every registered practice.</p>
      </div>

      {statsQ.data && (
        <div className="grid stat-tiles" style={{ marginBottom: 16 }}>
          <StatTile label="Total practices" value={statsQ.data.totalTenants ?? '—'} />
          <StatTile label="Active" value={statsQ.data.activeTenants ?? '—'} />
          <StatTile label="Total appointments" value={statsQ.data.totalAppointments ?? '—'} />
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <input className="input" style={{ flex: 1 }} placeholder="Search by name or slug…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Practice</th>
                <th>Slug</th>
                <th>Owner email</th>
                <th>Status</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No practices found.</td></tr>
              ) : rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{t.name}</div>
                    {t.contact_email && <div className="muted" style={{ fontSize: 12 }}>{t.contact_email}</div>}
                  </td>
                  <td><code style={{ fontSize: 12 }}>{t.slug}</code></td>
                  <td className="muted" style={{ fontSize: 13 }}>{(t as any).owner?.email ?? '—'}</td>
                  <td><TenantStatusBadge status={t.status} /></td>
                  <td className="muted" style={{ fontSize: 12 }}>{new Date((t as any).createdAt).toLocaleDateString()}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {t.status === 'active' ? (
                      <button
                        className="btn"
                        style={{ fontSize: 12, padding: '4px 10px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                        onClick={() => { if (confirm(`Suspend "${t.name}"?`)) suspend.mutate(t.id); }}
                        disabled={suspend.isPending}
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => reactivate.mutate(t.id)}
                        disabled={reactivate.isPending}
                      >
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function TenantStatusBadge({ status }: { status: string }) {
  const color = status === 'active' ? 'var(--success)' : 'var(--danger)';
  return <span style={{ fontSize: 12, fontWeight: 600, color }}>{status}</span>;
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card stat">
      <div className="num">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}
