import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { NAV } from '../lib/nav';

export default function Layout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const items = NAV.filter((n) => can(n.module, 'read'));

  return (
    <div className="app-shell">
      {drawerOpen && (
        <div className="sidebar-overlay" onClick={() => setDrawerOpen(false)} />
      )}
      <aside className={`sidebar ${drawerOpen ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">+</span> OPD Admin
        </div>
        {items.map((n) => (
          <NavLink
            key={n.path}
            to={n.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span aria-hidden>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
        {user?.type === 'doctor' && (
          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span aria-hidden>🧑‍⚕️</span>
            My profile
          </NavLink>
        )}
        <div className="spacer" />
        <button
          className="btn btn-ghost"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          Sign out
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            className="hamburger"
            aria-label="Menu"
            onClick={() => setDrawerOpen((v) => !v)}
          >
            ☰
          </button>
          <div className="who">
            {user?.name} · <span className="muted">{user?.type.replace('_', ' ')}</span>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
