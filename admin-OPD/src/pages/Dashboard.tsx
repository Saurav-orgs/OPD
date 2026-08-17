import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { Badge, Empty, Loading } from '../components/ui';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.summary,
  });
  if (isLoading) return <Loading />;
  if (error) return <Empty>Could not load the dashboard.</Empty>;
  if (!data) return null;

  const done = data.byStatus['done'] ?? 0;
  const onHold = data.byStatus['on_hold'] ?? 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <div className="hero">
        <h1>
          {greeting}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p>Here’s what’s happening today · {data.date}</p>
      </div>

      <div className="grid stat-tiles" style={{ marginBottom: 16 }}>
        <Tile accent="blue" icon="🗓" num={data.total} label="Today’s appointments" />
        <Tile accent="teal" icon="✔" num={done} label="Consultations done" />
        <Tile accent="amber" icon="⏸" num={onHold} label="On hold" />
      </div>

      <div className="card">
          <div className="card-title">Today’s schedule</div>
          {data.appointments.length === 0 ? (
            <div className="empty">Nothing booked for today.</div>
          ) : (
            <div className="table-wrap" style={{ border: 'none', maxHeight: 360, overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ minWidth: 440 }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--page)' }}>Time</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--page)' }}>Patient</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--page)' }}>Mobile</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--page)' }}>Consultation</th>
                  </tr>
                </thead>
                <tbody>
                  {data.appointments.map((a) => (
                    <tr
                      key={a.id}
                      className="clickable-row"
                      onClick={() => navigate(`/appointments?selected=${a.id}`)}
                    >
                      <td>{a.start_time?.slice(0, 5)}</td>
                      <td>{a.patient_name}</td>
                      <td className="muted">{a.patient_mobile}</td>
                      <td>
                        <Badge value={a.consultation_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </>
  );
}

function Tile({
  accent,
  icon,
  num,
  label,
}: {
  accent: 'blue' | 'teal' | 'amber' | 'gray';
  icon: string;
  num: number;
  label: string;
}) {
  const bar = {
    blue: 'var(--primary)',
    teal: 'var(--secondary)',
    amber: 'var(--state-on-hold)',
    gray: 'var(--state-booked)',
  }[accent];
  return (
    <div className={`card stat accent-${accent}`}>
      <div className="stat-bar" style={{ background: bar }} />
      <span className="ico">{icon}</span>
      <div className="num">{num}</div>
      <div className="label">{label}</div>
    </div>
  );
}
