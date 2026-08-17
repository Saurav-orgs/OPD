import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/endpoints';
import { tokenStore, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Field } from '../components/ui';

export default function Signup() {
  const navigate = useNavigate();
  const { setUser } = useAuth() as any;
  const [form, setForm] = useState({
    doctor_name: '',
    email: '',
    password: '',
    mobile: '',
    specialization: '',
    clinic_name: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await authApi.register({
        doctor_name: form.doctor_name,
        email: form.email,
        password: form.password,
        mobile: form.mobile,
        specialization: form.specialization || undefined,
        clinic_name: form.clinic_name || undefined,
      });
      tokenStore.set(res.accessToken);
      setUser(res.user);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="card login-card" style={{ maxWidth: 480 }}>
        <div className="login-logo">+</div>
        <h1 style={{ fontSize: 20 }}>Register your practice</h1>
        <p className="muted" style={{ marginTop: 6, marginBottom: 24 }}>
          Create a free account to start accepting patient appointments.
        </p>
        <form onSubmit={onSubmit}>
          <div className="grid cols-2">
            <Field label="Your name">
              <input className="input" value={form.doctor_name} onChange={set('doctor_name')} required autoFocus />
            </Field>
            <Field label="Specialization">
              <input className="input" value={form.specialization} onChange={set('specialization')} placeholder="e.g. Cardiologist" />
            </Field>
          </div>
          <Field label="Practice name (optional)">
            <input className="input" value={form.clinic_name} onChange={set('clinic_name')} placeholder={`Dr. ${form.doctor_name || '…'}'s Clinic`} />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={form.email} onChange={set('email')} required />
          </Field>
          <div className="grid cols-2">
            <Field label="Mobile">
              <input className="input" type="tel" value={form.mobile} onChange={set('mobile')} required />
            </Field>
            <Field label="Password">
              <input className="input" type="password" value={form.password} onChange={set('password')} minLength={8} required />
            </Field>
          </div>
          {error && <div className="err" style={{ marginBottom: 12 }}>{error}</div>}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16, textAlign: 'center', fontSize: 14 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
