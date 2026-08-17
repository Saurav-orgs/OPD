import React, { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  FileText,
  Trash2,
  Upload,
  ExternalLink,
} from 'lucide-react';
import { api } from '../api';
import { ApiException } from '../types';
import { StateView } from '../components/StateView';
import { formatDate } from './MyAppointments';

function humanSize(bytes: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const AppointmentDetail: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const { data, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ['my-appointment', id],
    queryFn: () => api.myAppointment(id),
  });

  const upload = useMutation({
    mutationFn: (f: File) => api.uploadReport(id, f),
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: ['my-appointment', id] });
    },
    onError: (e) =>
      setError(e instanceof ApiException ? e.message : 'Could not upload that file.'),
  });

  const remove = useMutation({
    mutationFn: (reportId: string) => api.deleteReport(reportId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-appointment', id] }),
    onError: (e) =>
      setError(e instanceof ApiException ? e.message : 'Could not remove that report.'),
  });

  if (isLoading) return <StateView loading />;
  if (loadError || !data) {
    return (
      <StateView
        error={loadError instanceof Error ? loadError.message : 'Could not load this visit.'}
        onRetry={() => refetch()}
      />
    );
  }

  const reports = data.reports ?? [];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <button className="back-link" onClick={() => navigate('/appointments')}>
        <ArrowLeft size={15} style={{ marginRight: 5 }} />
        All visits
      </button>

      <div className="section-card" style={{ marginTop: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{data.doctor?.name}</div>
        {data.doctor?.specialization && (
          <div style={{ color: 'var(--muted, #64748B)', fontSize: 14, marginTop: 2 }}>
            {data.doctor.specialization}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          <Row icon={<CalendarDays size={15} />}>
            {formatDate(data.appointmentDate)} · {data.startTime}–{data.endTime}
          </Row>
          {data.clinic && <Row icon={<Building2 size={15} />}>{data.clinic.name}</Row>}
        </div>

        {data.description && (
          <p style={{ marginTop: 14, fontSize: 14 }}>
            <strong>Reason for visit: </strong>
            {data.description}
          </p>
        )}

        {data.doctorNotes && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 8,
              background: 'rgba(37,99,235,0.06)',
              fontSize: 14,
            }}
          >
            <strong>Doctor&apos;s note</strong>
            <div style={{ marginTop: 4 }}>{data.doctorNotes}</div>
          </div>
        )}
      </div>

      <div className="section-card" style={{ marginTop: 14 }}>
        <div className="card-section-title">Medical reports</div>
        <p style={{ color: 'var(--muted, #64748B)', fontSize: 13, marginBottom: 12 }}>
          Upload prior reports so the doctor can review them before your visit. PDF or
          image, up to 10&nbsp;MB.
        </p>

        {reports.length === 0 ? (
          <div style={{ color: 'var(--muted, #64748B)', fontSize: 14, marginBottom: 12 }}>
            Nothing uploaded yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {reports.map((r) => (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  border: '1px solid rgba(148,163,184,0.3)',
                  borderRadius: 8,
                }}
              >
                <FileText size={18} color="#2563EB" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.fileName}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted, #64748B)' }}>
                    {humanSize(r.sizeBytes)}
                  </div>
                </div>
                {r.viewUrl && (
                  <a
                    href={r.viewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="back-link"
                    title="Open report"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
                <button
                  className="back-link"
                  title="Remove report"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (confirm(`Remove "${r.fileName}"?`)) remove.mutate(r.id);
                  }}
                >
                  <Trash2 size={16} color="#DC2626" />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <div className="error-text">{error}</div>}

        <input
          ref={fileRef}
          type="file"
          hidden
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = '';
          }}
        />
        <button
          className="btn-outlined"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
        >
          <Upload size={15} style={{ marginRight: 6 }} />
          {upload.isPending ? 'Uploading…' : 'Upload report'}
        </button>
      </div>
    </div>
  );
};

const Row: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({
  icon,
  children,
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14 }}>
    <span style={{ color: '#64748B', display: 'flex' }}>{icon}</span>
    {children}
  </div>
);
