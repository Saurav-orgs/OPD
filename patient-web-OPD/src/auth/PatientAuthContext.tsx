import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, patientToken } from '../api';
import type { Patient } from '../types';

interface PatientAuthValue {
  patient: Patient | null;
  mobile: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  /** True once name + age + gender are all on file. */
  isProfileComplete: boolean;
  setSession: (token: string, patient: Patient | null) => void;
  refresh: () => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<PatientAuthValue | null>(null);

export const PatientAuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [mobile, setMobile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!patientToken.get()) {
      setPatient(null);
      setMobile(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.me();
      setMobile(me.mobile);
      setPatient(me.patient);
    } catch {
      // Token rejected or expired — drop it rather than loop on failures.
      patientToken.clear();
      setPatient(null);
      setMobile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setSession = useCallback((token: string, p: Patient | null) => {
    patientToken.set(token);
    setPatient(p);
    setMobile(p?.mobile ?? null);
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    patientToken.clear();
    setPatient(null);
    setMobile(null);
  }, []);

  const value = useMemo<PatientAuthValue>(
    () => ({
      patient,
      mobile,
      loading,
      isAuthenticated: Boolean(patientToken.get()),
      isProfileComplete: Boolean(
        patient && patient.name && patient.age != null && patient.gender
      ),
      setSession,
      refresh,
      logout,
    }),
    [patient, mobile, loading, setSession, refresh, logout]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function usePatientAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePatientAuth must be used within PatientAuthProvider');
  return ctx;
}
