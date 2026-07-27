import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PhoneCall } from 'lucide-react';
import { DoctorList } from './pages/DoctorList';
import { DoctorDetail } from './pages/DoctorDetail';
import { BookingForm } from './pages/BookingForm';
import { Confirmation } from './pages/Confirmation';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { Footer } from './components/Footer';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="web-app-shell">
          <header className="web-navbar">
            <div className="web-navbar-inner">
              <Link to="/" className="web-brand">
                <span className="brand-icon">+</span>
                <span>OPD Patient Portal</span>
              </Link>

              <div className="web-nav-links">
                <div className="web-contact-pill">
                  <PhoneCall size={14} />
                  <span>24/7 OPD Helpline</span>
                </div>
              </div>
            </div>
          </header>

          <main className="web-container">
            <Routes>
              <Route path="/" element={<DoctorList />} />
              <Route path="/doctor/:id" element={<DoctorDetail />} />
              <Route path="/book" element={<BookingForm />} />
              <Route path="/confirmation" element={<Confirmation />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <Footer />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
