import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, CalendarDays, ChevronRight, Stethoscope } from 'lucide-react';
import { api } from '../api';
import { StateView } from '../components/StateView';
import type { PatientAppointment } from '../types';

export function formatDate(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: 'rgba(245,158,11,0.12)', fg: '#B45309', label: 'Upcoming' },
  done: { bg: 'rgba(16,185,129,0.12)', fg: '#047857', label: 'Completed' },
  on_hold: { bg: 'rgba(100,116,139,0.14)', fg: '#475569', label: 'On hold' },
  rejected: { bg: 'rgba(239,68,68,0.12)', fg: '#B91C1C', label: 'Cancelled' },
};

export const MyAppointments: React.FC = () => {
  const navigate = useNavigate();
  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: api.myAppointments,
  });

  if (isLoading) return <StateView loading />;
  if (error) {
    return (
      <StateView
        error={error instanceof Error ? error.message : 'Could not load your visits.'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '8px 0 4px' }}>My visits</h1>
      <p style={{ color: 'var(--muted, #64748B)', fontSize: 14, marginBottom: 20 }}>
        Every appointment you have booked, across all clinics.
      </p>

      {data.length === 0 ? (
        <StateView empty="You have not booked any appointments yet." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.map((a) => (
            <AppointmentRow
              key={a.id}
              appointment={a}
              onClick={() => navigate(`/appointments/${a.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const AppointmentRow: React.FC<{
  appointment: PatientAppointment;
  onClick: () => void;
}> = ({ appointment: a, onClick }) => {
  const s = STATUS_STYLE[a.consultationStatus] ?? STATUS_STYLE.pending;
  return (
    <div
      className="section-card"
      onClick={onClick}
      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            {a.doctor?.name ?? 'Doctor'}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 20,
              background: s.bg,
              color: s.fg,
            }}
          >
            {s.label}
          </span>
        </div>

        {a.doctor?.specialization && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              color: 'var(--muted, #64748B)',
              fontSize: 13,
              marginTop: 3,
            }}
          >
            <Stethoscope size={13} />
            {a.doctor.specialization}
          </div>
        )}

        {a.clinic && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              color: 'var(--muted, #64748B)',
              fontSize: 13,
              marginTop: 3,
            }}
          >
            <Building2 size={13} />
            {a.clinic.name}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 13,
            marginTop: 6,
            fontWeight: 500,
          }}
        >
          <CalendarDays size={13} />
          {formatDate(a.appointmentDate)} · {a.startTime}
        </div>
      </div>

      <ChevronRight size={18} color="#94A3B8" />
    </div>
  );
};
