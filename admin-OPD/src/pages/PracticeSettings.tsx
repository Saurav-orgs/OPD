import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '../api/endpoints';
import { useToast } from '../components/Toast';
import { Field, Loading, Empty } from '../components/ui';

export default function PracticeSettings() {
  const tenantQ = useQuery({ queryKey: ['tenant'], queryFn: tenantApi.get });
  const checkQ = useQuery({ queryKey: ['onboarding'], queryFn: tenantApi.onboarding });

  if (tenantQ.isLoading) return <Loading />;
  if (tenantQ.error) return <Empty>Could not load practice settings.</Empty>;

  return (
    <>
      <div className="hero">
        <h1>Practice settings</h1>
        <p>Manage your clinic details, branding, and live status.</p>
      </div>

      {checkQ.data && !checkQ.data.complete && (
        <div className="card" style={{ background: 'var(--state-booked)', marginBottom: 16 }}>
          <strong>Setup incomplete</strong> — finish your{' '}
          <a href="/onboarding">onboarding checklist</a> to make your practice visible to patients.
        </div>
      )}

      <div className="grid cols-1-2" style={{ alignItems: 'flex-start' }}>
        <InfoForm tenant={tenantQ.data} />
        <LogoSection tenant={tenantQ.data} />
      </div>

      <PublicLink tenant={tenantQ.data} />
    </>
  );
}

// ── Info form ──────────────────────────────────────────────────

function InfoForm({ tenant }: { tenant: any }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: tenant?.name ?? '',
    contact_email: tenant?.contact_email ?? '',
    contact_phone: tenant?.contact_phone ?? '',
    address: tenant?.address ?? '',
    timezone: tenant?.timezone ?? 'Asia/Kolkata',
  });

  const save = useMutation({
    mutationFn: () => tenantApi.update(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenant'] }); toast.success('Practice info saved'); },
    onError: (e) => toast.error(e),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="card">
      <div className="card-title">Clinic details</div>
      <Field label="Practice name"><input className="input" value={form.name} onChange={set('name')} /></Field>
      <Field label="Contact email"><input className="input" type="email" value={form.contact_email} onChange={set('contact_email')} /></Field>
      <Field label="Contact phone"><input className="input" type="tel" value={form.contact_phone} onChange={set('contact_phone')} /></Field>
      <Field label="Address"><input className="input" value={form.address} onChange={set('address')} /></Field>
      <Field label="Timezone">
        <select className="input" value={form.timezone} onChange={set('timezone')}>
          <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
          <option value="Asia/Dubai">Asia/Dubai (GST)</option>
          <option value="UTC">UTC</option>
          <option value="America/New_York">America/New_York (ET)</option>
          <option value="Europe/London">Europe/London (GMT/BST)</option>
        </select>
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ── Logo section ───────────────────────────────────────────────

function LogoSection({ tenant }: { tenant: any }) {
  const toast = useToast();
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: (f: File) => tenantApi.uploadLogo(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenant'] }); toast.success('Logo updated'); },
    onError: (e) => toast.error(e),
  });

  return (
    <div className="card">
      <div className="card-title">Practice logo</div>
      {tenant?.logo_url ? (
        <img src={tenant.logo_url} alt="Logo" style={{ maxWidth: 160, maxHeight: 100, borderRadius: 8, marginBottom: 12, objectFit: 'contain' }} />
      ) : (
        <div style={{ width: 160, height: 100, background: 'var(--surface)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, color: 'var(--muted)' }}>
          No logo
        </div>
      )}
      <input ref={ref} type="file" hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }} />
      <button className="btn" onClick={() => ref.current?.click()} disabled={upload.isPending}>
        {upload.isPending ? 'Uploading…' : 'Upload logo'}
      </button>
      <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>PNG or JPG, recommended 400×200 px.</p>
    </div>
  );
}

// ── Public link ────────────────────────────────────────────────

function PublicLink({ tenant }: { tenant: any }) {
  if (!tenant?.slug) return null;
  const url = `${window.location.origin.replace('admin', 'patient')}/c/${tenant.slug}`;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-title">Public clinic link</div>
      <p className="muted" style={{ marginBottom: 8 }}>Share this link so patients can find your clinic.</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <code style={{ padding: '6px 10px', background: 'var(--surface)', borderRadius: 6, fontSize: 13, flex: 1, wordBreak: 'break-all' }}>
          {url}
        </code>
        <button className="btn" onClick={() => navigator.clipboard.writeText(url).then(() => alert('Copied!'))}>Copy</button>
      </div>
    </div>
  );
}
