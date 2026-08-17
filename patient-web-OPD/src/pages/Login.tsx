import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, ArrowRight, RotateCcw } from 'lucide-react';
import { api } from '../api';
import { ApiException } from '../types';
import { usePatientAuth } from '../auth/PatientAuthContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const { setSession } = usePatientAuth();

  const [step, setStep] = useState<'mobile' | 'code'>('mobile');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { expiresInSeconds } = await api.requestOtp(mobile);
      setStep('code');
      setSecondsLeft(expiresInSeconds);
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.verifyOtp(mobile, code);
      setSession(res.accessToken, res.patient);
      const needsProfile =
        !res.patient || res.patient.age == null || !res.patient.gender;
      navigate(needsProfile ? '/complete-profile' : location.state?.from ?? '/appointments', {
        replace: true,
      });
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not verify the code.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 440, margin: '32px auto' }}>
      <div className="section-card">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'rgba(37,99,235,0.1)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <ShieldCheck size={26} color="#2563EB" />
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            {step === 'mobile' ? 'Sign in to continue' : 'Enter the code'}
          </h2>
          <p style={{ color: 'var(--muted, #64748B)', fontSize: 14, marginTop: 6 }}>
            {step === 'mobile'
              ? 'We will text a one-time code to your mobile number.'
              : `We sent a 6-digit code to ${mobile}.`}
          </p>
        </div>

        {step === 'mobile' ? (
          <form onSubmit={sendCode}>
            <div className="form-field">
              <label className="form-label">Mobile number</label>
              <input
                className="form-input"
                type="tel"
                inputMode="numeric"
                autoFocus
                placeholder="9876543210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
              />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button
              className="btn-primary"
              style={{ width: '100%', marginTop: 8 }}
              disabled={busy || mobile.trim().length < 10}
            >
              {busy ? 'Sending…' : 'Send code'}
              {!busy && <ArrowRight size={16} style={{ marginLeft: 6 }} />}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <div className="form-field">
              <label className="form-label">6-digit code</label>
              <input
                className="form-input"
                inputMode="numeric"
                autoFocus
                maxLength={6}
                placeholder="••••••"
                style={{ letterSpacing: '0.4em', textAlign: 'center', fontSize: 20 }}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button
              className="btn-primary"
              style={{ width: '100%', marginTop: 8 }}
              disabled={busy || code.length !== 6}
            >
              {busy ? 'Verifying…' : 'Verify & continue'}
            </button>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 14,
                fontSize: 13,
              }}
            >
              <button
                type="button"
                className="back-link"
                onClick={() => {
                  setStep('mobile');
                  setCode('');
                  setError('');
                }}
              >
                Change number
              </button>
              <button
                type="button"
                className="back-link"
                disabled={secondsLeft > 0 || busy}
                onClick={() => sendCode()}
                style={{ opacity: secondsLeft > 0 ? 0.5 : 1 }}
              >
                <RotateCcw size={13} style={{ marginRight: 4 }} />
                {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
