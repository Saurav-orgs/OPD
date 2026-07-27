import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { doctorsApi } from '../api/endpoints';
import type { Doctor } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { ActionMenuDropdown, Badge, Empty, Field, Loading, Modal } from '../components/ui';

export default function Doctors() {
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Doctor | 'new' | null>(null);
  const [confirmDoctor, setConfirmDoctor] = useState<Doctor | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['doctors'], queryFn: doctorsApi.list });

  const toggle = useMutation({
    mutationFn: (d: Doctor) => (d.is_enabled ? doctorsApi.disable(d.id) : doctorsApi.enable(d.id)),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['doctors'] });
      toast.success(d.is_enabled ? 'Doctor enabled' : 'Doctor disabled');
    },
    onError: (e) => toast.error(e),
  });

  if (isLoading) return <Loading />;

  return (
    <>
      <div className="page-head">
        <h1>Doctors</h1>
        {can('doctors', 'create') && (
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            + Add doctor
          </button>
        )}
      </div>

      {!data?.length ? (
        <Empty>No doctors yet.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Specialization</th>
                <th>Fee</th>
                <th>Visibility</th>
                <th style={{ width: 1, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td className="muted">{d.specialization || '—'}</td>
                  <td>{d.consultation_fee ? `₹${d.consultation_fee}` : '—'}</td>
                  <td>
                    <Badge
                      value={d.is_enabled ? 'available' : 'booked'}
                      label={d.is_enabled ? 'Enabled' : 'Disabled'}
                    />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <DoctorActionMenu
                      doctor={d}
                      canSchedule={can('opd_schedules', 'read')}
                      canUpdate={can('doctors', 'update')}
                      onSchedule={() => navigate(`/doctors/${d.id}/schedule`)}
                      onEdit={() => setEditing(d)}
                      onToggle={() => setConfirmDoctor(d)}
                      isPending={toggle.isPending}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDoctor && (
        <Modal
          title={confirmDoctor.is_enabled ? 'Disable Doctor' : 'Enable Doctor'}
          onClose={() => setConfirmDoctor(null)}
        >
          <p style={{ margin: '12px 0 20px', color: 'var(--text)' }}>
            Are you sure you want to {confirmDoctor.is_enabled ? 'disable' : 'enable'}{' '}
            <strong>{confirmDoctor.name}</strong>?
          </p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setConfirmDoctor(null)}>
              No
            </button>
            <button
              className={`btn ${confirmDoctor.is_enabled ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => {
                toggle.mutate(confirmDoctor);
                setConfirmDoctor(null);
              }}
              disabled={toggle.isPending}
            >
              {toggle.isPending ? 'Processing…' : 'Yes'}
            </button>
          </div>
        </Modal>
      )}

      {editing && (
        <DoctorModal
          doctor={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function DoctorActionMenu({
  doctor,
  canSchedule,
  canUpdate,
  onSchedule,
  onEdit,
  onToggle,
  isPending,
}: {
  doctor: Doctor;
  canSchedule: boolean;
  canUpdate: boolean;
  onSchedule: () => void;
  onEdit: () => void;
  onToggle: () => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  if (!canSchedule && !canUpdate) return null;

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
          {canSchedule && (
            <button
              type="button"
              className="action-menu-item"
              onClick={() => {
                setOpen(false);
                onSchedule();
              }}
            >
              Schedule
            </button>
          )}
          {canUpdate && (
            <>
              <button
                type="button"
                className="action-menu-item"
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className={`action-menu-item ${doctor.is_enabled ? 'danger' : ''}`}
                disabled={isPending}
                onClick={() => {
                  setOpen(false);
                  onToggle();
                }}
              >
                {doctor.is_enabled ? 'Disable' : 'Enable'}
              </button>
            </>
          )}
        </ActionMenuDropdown>
      )}
    </div>
  );
}

function DoctorModal({ doctor, onClose }: { doctor: Doctor | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const qrRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: doctor?.name ?? '',
    specialization: doctor?.specialization ?? '',
    qualifications: doctor?.qualifications ?? '',
    consultation_fee: doctor?.consultation_fee ?? '',
    bio: doctor?.bio ?? '',
  });

  // Files are picked locally and uploaded on Save — so a brand-new doctor can
  // get a photo + QR in one go (no need to save first, then re-open).
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    doctor?.profile_photo_url ?? null,
  );
  const [qrPreview, setQrPreview] = useState<string | null>(
    doctor?.payment_qr_url ?? null,
  );

  const pickPhoto = (f: File) => {
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };
  const pickQr = (f: File) => {
    setQrFile(f);
    setQrPreview(URL.createObjectURL(f));
  };

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name: form.name,
        specialization: form.specialization || undefined,
        qualifications: form.qualifications || undefined,
        bio: form.bio || undefined,
        consultation_fee: form.consultation_fee === '' ? undefined : Number(form.consultation_fee),
      };
      // Create/update first to obtain the id the upload endpoints need,
      // then upload any newly-picked images to it.
      const saved = doctor
        ? await doctorsApi.update(doctor.id, body)
        : await doctorsApi.create(body);
      if (photoFile) await doctorsApi.uploadPhoto(saved.id, photoFile);
      if (qrFile) await doctorsApi.uploadQr(saved.id, qrFile);
      return saved;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctors'] });
      toast.success(doctor ? 'Doctor updated' : 'Doctor created');
      onClose();
    },
    onError: (e) => toast.error(e),
  });

  return (
    <Modal title={doctor ? 'Edit doctor' : 'Add doctor'} onClose={onClose} large>
      <div className="grid cols-2">
        <Field label="Name">
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Specialization">
          <input
            className="input"
            value={form.specialization}
            onChange={(e) => setForm({ ...form, specialization: e.target.value })}
          />
        </Field>
        <Field label="Qualifications">
          <input
            className="input"
            value={form.qualifications}
            onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
          />
        </Field>
        <Field label="Consultation fee (₹)">
          <input
            className="input"
            type="number"
            value={form.consultation_fee}
            onChange={(e) => setForm({ ...form, consultation_fee: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Bio">
        <textarea
          className="input"
          rows={3}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
      </Field>

      <div className="grid cols-2" style={{ marginTop: 4 }}>
        <div className="card" style={{ background: 'var(--page)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 500 }}>Profile photo</div>
              <span className="muted">Shown to patients.</span>
            </div>
            {photoPreview && (
              <img src={photoPreview} alt="Photo" className="avatar" />
            )}
          </div>
          <input
            ref={photoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickPhoto(f);
            }}
          />
          <button
            className="btn btn-sm"
            style={{ marginTop: 10 }}
            onClick={() => photoRef.current?.click()}
          >
            {photoPreview ? 'Change photo' : 'Upload photo'}
          </button>
        </div>

        <div className="card" style={{ background: 'var(--page)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 500 }}>Payment QR</div>
              <span className="muted">Shown on the booking screen.</span>
            </div>
            {qrPreview && (
              <img src={qrPreview} alt="QR" className="thumb" style={{ height: 56 }} />
            )}
          </div>
          <input
            ref={qrRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickQr(f);
            }}
          />
          <button
            className="btn btn-sm"
            style={{ marginTop: 10 }}
            onClick={() => qrRef.current?.click()}
          >
            {qrPreview ? 'Change QR' : 'Upload QR'}
          </button>
        </div>
      </div>

      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={() => save.mutate()}
          disabled={save.isPending || !form.name.trim()}
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}
