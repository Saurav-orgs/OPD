import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi, doctorsApi } from '../api/endpoints';
import { useToast } from '../components/Toast';
import { Loading, Field } from '../components/ui';

const STEPS = ['Profile', 'Photo', 'Consultation fee', 'Payment QR', 'Schedule', 'Go live'] as const;

export default function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);

  const checkQ = useQuery({ queryKey: ['onboarding'], queryFn: tenantApi.onboarding });
  const meQ = useQuery({ queryKey: ['doctor-me'], queryFn: doctorsApi.me });

  if (checkQ.isLoading || meQ.isLoading) return <div className="center-screen"><Loading /></div>;

  // If already complete, redirect to dashboard.
  if (checkQ.data?.complete) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  return (
    <div className="auth-screen" style={{ alignItems: 'flex-start', paddingTop: 48 }}>
      <div className="card" style={{ maxWidth: 600, width: '100%' }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Set up your practice</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Complete each step to go live and start accepting bookings.
        </p>

        {/* Step bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28, flexWrap: 'wrap' }}>
          {STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i)}
              style={{
                padding: '4px 12px',
                borderRadius: 20,
                border: '1px solid var(--border)',
                background: step === i ? 'var(--primary)' : 'transparent',
                color: step === i ? '#fff' : 'var(--text)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {step === 0 && <StepProfile doctor={meQ.data} onDone={() => { qc.invalidateQueries({ queryKey: ['onboarding'] }); setStep(1); }} />}
        {step === 1 && <StepPhoto onDone={() => { qc.invalidateQueries({ queryKey: ['onboarding'] }); setStep(2); }} />}
        {step === 2 && <StepFee doctor={meQ.data} onDone={() => { qc.invalidateQueries({ queryKey: ['onboarding'] }); setStep(3); }} />}
        {step === 3 && <StepQR onDone={() => { qc.invalidateQueries({ queryKey: ['onboarding'] }); setStep(4); }} />}
        {step === 4 && <StepSchedule onDone={() => { qc.invalidateQueries({ queryKey: ['onboarding'] }); setStep(5); }} />}
        {step === 5 && <StepGoLive checklist={checkQ.data} onDone={() => navigate('/dashboard', { replace: true })} />}
      </div>
    </div>
  );
}

// ── Step components ────────────────────────────────────────────

function StepProfile({ doctor, onDone }: { doctor: any; onDone: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: doctor?.name ?? '',
    specialization: doctor?.specialization ?? '',
    qualifications: doctor?.qualifications ?? '',
    bio: doctor?.bio ?? '',
  });
  const save = useMutation({
    mutationFn: () => doctorsApi.updateMe(form),
    onSuccess: () => { toast.success('Profile saved'); onDone(); },
    onError: (e) => toast.error(e),
  });
  return (
    <div>
      <div className="card-title">Doctor profile</div>
      <div className="grid cols-2">
        <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Specialization"><input className="input" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} /></Field>
        <Field label="Qualifications"><input className="input" value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} /></Field>
      </div>
      <Field label="Bio"><textarea className="input" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save & continue'}</button>
      </div>
    </div>
  );
}

function StepPhoto({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const meQ = useQuery({ queryKey: ['doctor-me'], queryFn: doctorsApi.me });
  const upload = useMutation({
    mutationFn: (f: File) => doctorsApi.uploadMyPhoto(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['doctor-me'] }); toast.success('Photo uploaded'); onDone(); },
    onError: (e) => toast.error(e),
  });
  return (
    <div>
      <div className="card-title">Profile photo</div>
      {meQ.data?.profile_photo_url && <img src={meQ.data.profile_photo_url} alt="" style={{ width: 120, borderRadius: 8, marginBottom: 12 }} />}
      <input ref={ref} type="file" hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }} />
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button className="btn" onClick={() => ref.current?.click()} disabled={upload.isPending}>{upload.isPending ? 'Uploading…' : 'Upload photo'}</button>
        <button className="btn" onClick={onDone}>Skip for now</button>
      </div>
    </div>
  );
}

function StepFee({ doctor, onDone }: { doctor: any; onDone: () => void }) {
  const toast = useToast();
  const [fee, setFee] = useState(doctor?.consultation_fee ?? '');
  const save = useMutation({
    mutationFn: () => doctorsApi.updateMe({ consultation_fee: fee ? Number(fee) : undefined } as any),
    onSuccess: () => { toast.success('Fee saved'); onDone(); },
    onError: (e) => toast.error(e),
  });
  return (
    <div>
      <div className="card-title">Consultation fee</div>
      <Field label="Fee (₹)"><input className="input" type="number" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save & continue'}</button>
        <button className="btn" onClick={onDone}>Skip</button>
      </div>
    </div>
  );
}

function StepQR({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const meQ = useQuery({ queryKey: ['doctor-me'], queryFn: doctorsApi.me });
  const upload = useMutation({
    mutationFn: (f: File) => doctorsApi.uploadMyQr(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['doctor-me'] }); toast.success('QR uploaded'); onDone(); },
    onError: (e) => toast.error(e),
  });
  return (
    <div>
      <div className="card-title">Payment QR code</div>
      <p className="muted" style={{ marginBottom: 12 }}>Patients will scan this QR to pay before booking.</p>
      {meQ.data?.payment_qr_url && <img src={meQ.data.payment_qr_url} alt="QR" style={{ width: 160, borderRadius: 8, marginBottom: 12 }} />}
      <input ref={ref} type="file" hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }} />
      <div>
        <button className="btn btn-primary" onClick={() => ref.current?.click()} disabled={upload.isPending}>{upload.isPending ? 'Uploading…' : 'Upload QR image'}</button>
      </div>
    </div>
  );
}

function StepSchedule({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const meQ = useQuery({ queryKey: ['doctor-me'], queryFn: doctorsApi.me });
  const doctorId = meQ.data?.id;
  return (
    <div>
      <div className="card-title">OPD schedule</div>
      <p className="muted" style={{ marginBottom: 16 }}>Set your working hours so patients can pick slots.</p>
      {doctorId ? (
        <button className="btn btn-primary" onClick={() => navigate(`/doctors/${doctorId}/schedule`)}>Open schedule editor</button>
      ) : <Loading />}
      <div style={{ marginTop: 12 }}>
        <button className="btn" onClick={onDone}>I&apos;ve set my schedule — continue</button>
      </div>
    </div>
  );
}

function StepGoLive({ checklist, onDone }: { checklist: any; onDone: () => void }) {
  const toast = useToast();
  const goLive = useMutation({
    mutationFn: tenantApi.goLive,
    onSuccess: () => { toast.success('Your practice is now live!'); onDone(); },
    onError: (e) => toast.error(e),
  });

  const checks = [
    { label: 'Doctor profile', done: checklist?.profile },
    { label: 'Payment QR', done: checklist?.payment_qr },
    { label: 'OPD schedule', done: checklist?.schedule },
  ];

  const canGoLive = checklist?.payment_qr && checklist?.schedule;

  return (
    <div>
      <div className="card-title">Ready to go live?</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {checks.map((c) => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: c.done ? 'var(--success)' : 'var(--danger)' }}>{c.done ? '✓' : '✗'}</span>
            <span style={{ color: c.done ? 'var(--text)' : 'var(--muted)' }}>{c.label}</span>
          </div>
        ))}
      </div>
      {!canGoLive && (
        <p className="err" style={{ marginBottom: 16 }}>Please add a payment QR and at least one schedule day before going live.</p>
      )}
      <button className="btn btn-primary" onClick={() => goLive.mutate()} disabled={!canGoLive || goLive.isPending}>
        {goLive.isPending ? 'Going live…' : 'Go live — make my practice visible to patients'}
      </button>
    </div>
  );
}
