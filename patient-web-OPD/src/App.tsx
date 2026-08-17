import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PhoneCall, CalendarCheck, LogOut, LogIn } from 'lucide-react';
import type { ReactNode } from 'react';
import { DoctorList } from './pages/DoctorList';
import { DoctorDetail } from './pages/DoctorDetail';
import { BookingForm } from './pages/BookingForm';
import { Confirmation } from './pages/Confirmation';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { Login } from './pages/Login';
import { CompleteProfile } from './pages/CompleteProfile';
import { MyAppointments } from './pages/MyAppointments';
import { AppointmentDetail } from './pages/AppointmentDetail';
import { Footer } from './components/Footer';
import { StateView } from './components/StateView';
import { PatientAuthProvider, usePatientAuth } from './auth/PatientAuthContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Gate for the patient's own records. Sends unregistered users to finish signup. */
function RequirePatient({ children }: { children: ReactNode }) {
  const { isAuthenticated, isProfileComplete, loading } = usePatientAuth();
  if (loading) return <StateView loading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isProfileComplete) return <Navigate to="/complete-profile" replace />;
  return <>{children}</>;
}

function NavBar() {
  const { isAuthenticated, patient, logout } = usePatientAuth();
  const navigate = useNavigate();

  return (
    <header className="web-navbar">
      <div className="web-navbar-inner">
        <Link to="/" className="web-brand">
          <span className="brand-icon">+</span>
          <span>OPD Patient Portal</span>
        </Link>

        <div className="web-nav-links">
          {isAuthenticated ? (
            <>
              <Link to="/appointments" className="web-nav-link">
                <CalendarCheck size={15} style={{ marginRight: 5 }} />
                My visits
              </Link>
              <button
                className="web-nav-link"
                title={patient?.mobile ? `Signed in as ${patient.mobile}` : 'Sign out'}
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                <LogOut size={15} style={{ marginRight: 5 }} />
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="web-nav-link">
              <LogIn size={15} style={{ marginRight: 5 }} />
              Sign in
            </Link>
          )}

          <div className="web-contact-pill">
            <PhoneCall size={14} />
            <span>24/7 OPD Helpline</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PatientAuthProvider>
          <div className="web-app-shell">
            <NavBar />

            <main className="web-container">
              <Routes>
                <Route path="/" element={<DoctorList />} />
                <Route path="/doctor/:id" element={<DoctorDetail />} />
                <Route path="/book" element={<BookingForm />} />
                <Route path="/confirmation" element={<Confirmation />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />

                <Route path="/login" element={<Login />} />
                <Route path="/complete-profile" element={<CompleteProfile />} />
                <Route
                  path="/appointments"
                  element={
                    <RequirePatient>
                      <MyAppointments />
                    </RequirePatient>
                  }
                />
                <Route
                  path="/appointments/:id"
                  element={
                    <RequirePatient>
                      <AppointmentDetail />
                    </RequirePatient>
                  }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>

            <Footer />
          </div>
        </PatientAuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
