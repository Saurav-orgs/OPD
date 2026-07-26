import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Loading } from './components/ui';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import Doctors from './pages/Doctors';
import DoctorSchedule from './pages/DoctorSchedule';
import Users from './pages/Users';
import Roles from './pages/Roles';
import Profile from './pages/Profile';
import type { ReactNode } from 'react';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen"><Loading /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Landing route: first module the user can see. */
function Home() {
  const { can, user } = useAuth();
  if (can('dashboard', 'read')) return <Navigate to="/dashboard" replace />;
  if (can('appointments', 'read')) return <Navigate to="/appointments" replace />;
  if (can('doctors', 'read')) return <Navigate to="/doctors" replace />;
  if (user?.type === 'doctor') return <Navigate to="/profile" replace />;
  return <Navigate to="/appointments" replace />;
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <div className="center-screen"><Loading /></div>;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/doctors" element={<Doctors />} />
        <Route path="/doctors/:id/schedule" element={<DoctorSchedule />} />
        <Route path="/users" element={<Users />} />
        <Route path="/roles" element={<Roles />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
