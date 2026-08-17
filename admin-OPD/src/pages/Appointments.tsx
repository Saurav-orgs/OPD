import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi, doctorsApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { ActionMenuDropdown, Badge, Empty, Loading, Modal } from '../components/ui';

export default function Appointments() {
  const { user, can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const paramId = searchParams.get('selected') || (location.state as { selectedId?: string } | null)?.selectedId || null;

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<{ doctorId?: string; date?: string; status?: string; search?: string }>({});
  const [selected, setSelected] = useState<string | null>(paramId);

  useEffect(() => {
    if (paramId) {
      setSelected(paramId);
    }
  }, [paramId]);

  const handleCloseModal = () => {
    setSelected(null);
    if (searchParams.has('selected')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('selected');
      setSearchParams(nextParams, { replace: true });
    }
  };

  // Debounce the free-text search so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      const q = searchInput.trim();
      setFilters((f) => ({ ...f, search: q || undefined }));
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Only admins pick a doctor; doctors are auto-scoped server-side.
  const doctorsQ = useQuery({
    queryKey: ['doctors'],
    queryFn: doctorsApi.list,
    enabled: user?.type !== 'doctor' && can('doctors', 'read'),
  });

  const listQ = useQuery({
    queryKey: ['appointments', filters],
    queryFn: () => appointmentsApi.list(filters),
  });

  return (
    <>
      <div className="page-head">
        <h1>Appointments</h1>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input
            className="input"
            type="search"
            placeholder="Search name or phone…"
            style={{ width: 240 }}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {doctorsQ.data && (
            <select
              className="select"
              style={{ width: 200 }}
              value={filters.doctorId ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, doctorId: e.target.value || undefined }))}
            >
              <option value="">All doctors</option>
              {doctorsQ.data.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          <input
            className="input"
            type="date"
            style={{ width: 160 }}
            value={filters.date ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value || undefined }))}
          />
          <select
            className="select"
            style={{ width: 150 }}
            value={filters.status ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined }))}
          >
            <option value="">Any status</option>
            <option value="confirmed">Confirmed</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            className="btn btn-sm"
            onClick={() => {
              setSearchInput('');
              setFilters({});
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {listQ.isLoading ? (
        <Loading />
      ) : !listQ.data?.length ? (
        <Empty>No appointments match these filters.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Payment</th>
                <th>Consultation</th>
                <th style={{ width: 1, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {listQ.data.map((a) => (
                <tr
                  key={a.id}
                  className="clickable-row"
                  onClick={() => setSelected(a.id)}
                >
                  <td>{a.appointment_date}</td>
                  <td>{a.start_time?.slice(0, 5)}</td>
                  <td>
                    {a.patient_name}
                    <div className="muted" style={{ fontSize: 12 }}>{a.patient_mobile}</div>
                  </td>
                  <td className="muted">{a.doctor?.name ?? '—'}</td>
                  <td><Badge value={a.payment_status} /></td>
                  <td><Badge value={a.consultation_status} /></td>
                  <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    <AppointmentActionMenu onView={() => setSelected(a.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <DetailModal id={selected} onClose={handleCloseModal} />}
    </>
  );
}

function AppointmentActionMenu({ onView }: { onView: () => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="action-menu-container">
      <button
        ref={btnRef}
        type="button"
        className="btn-dots"
        aria-label="Actions"
        onClick={() => setOpen((v) => !v)}
      >
        ⋮
      </button>
      {open && (
        <ActionMenuDropdown btnRef={btnRef} onClose={() => setOpen(false)}>
          <button
            type="button"
            className="action-menu-item"
            onClick={() => {
              setOpen(false);
              onView();
            }}
          >
            View details
          </button>
        </ActionMenuDropdown>
      )}
    </div>
  );
}

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canUpdate = can('appointments', 'update');

  const { data: a, isLoading } = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => appointmentsApi.get(id),
  });

  // Local draft for the doctor's note, seeded from the loaded appointment.
  const [notes, setNotes] = useState('');
  useEffect(() => {
    setNotes(a?.doctor_notes ?? '');
  }, [a?.doctor_notes]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['appointment', id] });
    qc.invalidateQueries({ queryKey: ['appointments'] });
  };

  const saveNotes = useMutation({
    mutationFn: (value: string) => appointmentsApi.setNotes(id, value),
    onSuccess: () => { invalidate(); toast.success('Note saved'); },
    onError: (e) => toast.error(e),
  });

  const consult = useMutation({
    mutationFn: (status: string) => appointmentsApi.setConsultation(id, status),
    onSuccess: () => { invalidate(); toast.success('Consultation updated'); },
    onError: (e) => toast.error(e),
  });
  const payment = useMutation({
    mutationFn: (status: string) => appointmentsApi.setPayment(id, status),
    onSuccess: () => { invalidate(); toast.success('Payment updated'); },
    onError: (e) => toast.error(e),
  });

  return (
    <Modal title="Appointment detail" onClose={onClose} large>
      {isLoading || !a ? (
        <Loading />
      ) : (
        <div className="grid cols-1-1-2">
          <div className="stack">
            <Detail label="Patient" value={a.patient_name} />
            <Detail label="Mobile" value={a.patient_mobile} />
            {(a.patient_age != null || a.patient_gender) && (
              <Detail
                label="Age / gender"
                value={[
                  a.patient_age != null ? `${a.patient_age} yrs` : null,
                  a.patient_gender ?? null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            )}
            <Detail label="Date & time" value={`${a.appointment_date} · ${a.start_time?.slice(0, 5)}–${a.end_time?.slice(0, 5)}`} />
            <Detail label="Doctor" value={a.doctor?.name ?? '—'} />
            {a.patient_address && <Detail label="Address" value={a.patient_address} />}
            {a.description && <Detail label="Reason" value={a.description} />}
            {a.source && <Detail label="Booking Source" value={a.source === 'app' ? 'Mobile App' : 'Web'} />}
            <div className="row">
              <Badge value={a.status} />
              <Badge value={a.payment_status} />
              <Badge value={a.consultation_status} />
            </div>
          </div>

          <div className="stack">
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Payment screenshot</div>
              {a.screenshot_url ? (
                <a href={a.screenshot_url} target="_blank" rel="noreferrer">
                  <img
                    src={a.screenshot_url}
                    alt="Payment screenshot"
                    style={{ width: '100%', borderRadius: 8, border: 'var(--hairline)' }}
                  />
                </a>
              ) : (
                <span className="muted">No screenshot.</span>
              )}
            </div>

            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Patient reports {a.reports?.length ? `(${a.reports.length})` : ''}
              </div>
              {!a.reports?.length ? (
                <span className="muted">No reports uploaded.</span>
              ) : (
                <div className="stack" style={{ gap: 6 }}>
                  {a.reports.map((r) => (
                    <a
                      key={r.id}
                      href={r.view_url ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="row"
                      style={{
                        gap: 8,
                        padding: '8px 10px',
                        border: 'var(--hairline)',
                        borderRadius: 8,
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <span aria-hidden>{r.mime_type === 'application/pdf' ? '📄' : '🖼'}</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.file_name}
                      </span>
                      <span className="muted" style={{ fontSize: 12 }}>Open</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {a && (
        <div style={{ marginTop: 20, borderTop: 'var(--hairline)', paddingTop: 16 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Doctor’s note · shown when this patient books their next OPD
          </div>
          {canUpdate ? (
            <>
              <textarea
                className="input"
                rows={4}
                placeholder="Add a note for this patient’s next visit…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={saveNotes.isPending || notes === (a.doctor_notes ?? '')}
                  onClick={() => saveNotes.mutate(notes)}
                >
                  {saveNotes.isPending ? 'Saving…' : 'Save note'}
                </button>
              </div>
            </>
          ) : a.doctor_notes ? (
            <div style={{ whiteSpace: 'pre-wrap' }}>{a.doctor_notes}</div>
          ) : (
            <span className="muted">No note yet.</span>
          )}
        </div>
      )}

      {a && canUpdate && (
        <div style={{ marginTop: 20, borderTop: 'var(--hairline)', paddingTop: 16 }}>
          <div className="grid cols-2" style={{ gap: 20 }}>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Payment review</div>
              <div className="row">
                <button className="btn btn-sm" disabled={payment.isPending} onClick={() => payment.mutate('verified')}>
                  Verify
                </button>
                <button className="btn btn-sm btn-danger" disabled={payment.isPending} onClick={() => payment.mutate('rejected')}>
                  Reject (frees slot)
                </button>
              </div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Consultation outcome</div>
              <div className="row">
                <button className="btn btn-sm" disabled={consult.isPending} onClick={() => consult.mutate('done')}>Done</button>
                <button className="btn btn-sm" disabled={consult.isPending} onClick={() => consult.mutate('on_hold')}>On hold</button>
                <button className="btn btn-sm btn-danger" disabled={consult.isPending} onClick={() => consult.mutate('rejected')}>Reject</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div>{value}</div>
    </div>
  );
}
