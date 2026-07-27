import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Stethoscope, ArrowRight, ShieldCheck, Clock, CheckCircle } from 'lucide-react';
import { api } from '../api';
import type { Doctor } from '../types';
import { NetworkAvatar } from '../components/NetworkAvatar';
import { StateView } from '../components/StateView';

export const DoctorList: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const {
    data: doctors = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['doctors'],
    queryFn: api.listDoctors,
  });

  const filteredDoctors = doctors.filter((d) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      (d.specialization && d.specialization.toLowerCase().includes(q))
    );
  });

  const countText = !query.trim()
    ? `${filteredDoctors.length} ${filteredDoctors.length === 1 ? 'Doctor' : 'Doctors'} Available for Consultation`
    : `${filteredDoctors.length} Result${filteredDoctors.length === 1 ? '' : 's'} Found`;

  return (
    <div>
      <div className="web-hero">
        <div className="web-hero-badges">
          <div className="hero-pill-badge">
            <CheckCircle size={14} color="#10B981" />
            <span>Verified Specialist Doctors</span>
          </div>
          <div className="hero-pill-badge">
            <Clock size={14} color="#60A5FA" />
            <span>Instant OPD Slot Booking</span>
          </div>
          <div className="hero-pill-badge">
            <ShieldCheck size={14} color="#F59E0B" />
            <span>Secure UPI Payment</span>
          </div>
        </div>

        <h1 className="web-hero-title">Find the Right Specialist & Book your Visit</h1>
        <p className="web-hero-subtitle">
          Connect with top doctors, check OPD availability in real-time, and confirm your appointment instantly.
        </p>

        <div className="search-box">
          <Search size={22} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search doctor by name, specialty (e.g. Cardiology, Dermatology)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="search-clear" onClick={() => setQuery('')}>
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div>
        {isLoading ? (
          <StateView loading />
        ) : error ? (
          <StateView
            error={error instanceof Error ? error.message : 'Could not load doctors.'}
            onRetry={() => refetch()}
          />
        ) : doctors.length === 0 ? (
          <StateView empty="No doctors are available right now." />
        ) : filteredDoctors.length === 0 ? (
          <StateView empty={'No doctors match "' + query + '".'} />
        ) : (
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '20px' }}>
              {countText}
            </div>

            <div className="doctor-grid">
              {filteredDoctors.map((doc) => (
                <DoctorCardItem
                  key={doc.id}
                  doctor={doc}
                  onClick={() => navigate('/doctor/' + doc.id, { state: { doctor: doc } })}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const DoctorCardItem: React.FC<{ doctor: Doctor; onClick: () => void }> = ({
  doctor,
  onClick,
}) => {
  return (
    <div className="doctor-card" onClick={onClick}>
      <div className="doctor-avatar-wrap">
        <NetworkAvatar url={doctor.profilePhotoUrl} size={76} alt={doctor.name} />
        <div className="doctor-online-dot" title="Available for OPD" />
      </div>

      <div className="doctor-info">
        <div className="doctor-name">{doctor.name}</div>

        {doctor.specialization && (
          <div className="doctor-spec-pill">
            <Stethoscope size={13} />
            <span>{doctor.specialization}</span>
          </div>
        )}

        {doctor.qualifications && (
          <div className="doctor-qual">{doctor.qualifications}</div>
        )}

        <div className="doctor-bottom-row">
          {doctor.consultationFee ? (
            <span className="fee-badge">₹{doctor.consultationFee} Fee</span>
          ) : (
            <span />
          )}

          <div className="book-btn-pill">
            <span>Book</span>
            <ArrowRight size={14} />
          </div>
        </div>
      </div>
    </div>
  );
};
