import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { api } from '../api';
import { ApiException, type Gender } from '../types';
import { usePatientAuth } from '../auth/PatientAuthContext';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export const CompleteProfile: React.FC = () => {
  const navigate = useNavigate();
  const { patient, mobile, refresh } = usePatientAuth();

  const [name, setName] = useState(patient?.name ?? '');
  const [age, setAge] = useState(patient?.age != null ? String(patient.age) : '');
  const [gender, setGender] = useState<Gender | ''>(patient?.gender ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.updateMe({
        name: name.trim(),
        age: Number(age),
        gender: gender || undefined,
      });
      await refresh();
      navigate('/appointments', { replace: true });
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not save your details.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 460, margin: '32px auto' }}>
      <div className="section-card">
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'rgba(16,185,129,0.12)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <UserRound size={26} color="#10B981" />
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Your details</h2>
          <p style={{ color: 'var(--muted, #64748B)', fontSize: 14, marginTop: 6 }}>
            Doctors use this on your prescriptions, so please keep it accurate.
          </p>
        </div>

        <form onSubmit={submit}>
          <div className="form-field">
            <label className="form-label">Mobile number</label>
            <input className="form-input" value={mobile ?? ''} disabled />
          </div>

          <div className="form-field">
            <label className="form-label">Full name</label>
            <input
              className="form-input"
              autoFocus
              placeholder="e.g. Asha Verma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Age</label>
            <input
              className="form-input"
              type="number"
              min={0}
              max={120}
              placeholder="e.g. 34"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Gender</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {GENDERS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGender(g.value)}
                  className={gender === g.value ? 'btn-primary' : 'btn-outlined'}
                  style={{ flex: 1 }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="error-text">{error}</div>}

          <button
            className="btn-primary"
            style={{ width: '100%', marginTop: 10 }}
            disabled={busy || !name.trim() || !age || !gender}
          >
            {busy ? 'Saving…' : 'Save and continue'}
          </button>
        </form>
      </div>
    </div>
  );
};
