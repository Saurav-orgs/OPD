import type { PermModule } from '../api/types';

export interface NavItem {
  path: string;
  label: string;
  module: PermModule;
  icon: string;
  platformOnly?: boolean; // only show for super_admin
}

/** Sidebar config — rendered dynamically from the user's read permissions. */
export const NAV: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', module: 'dashboard', icon: '▦' },
  { path: '/appointments', label: 'Appointments', module: 'appointments', icon: '🗓' },
  { path: '/practice', label: 'Practice', module: 'tenant', icon: '🏥' },
  { path: '/users', label: 'Team', module: 'users', icon: '👥' },
  { path: '/roles', label: 'Roles', module: 'roles', icon: '🔑' },
  // Platform super_admin only:
  { path: '/platform/tenants', label: 'All Practices', module: 'platform', icon: '🌐', platformOnly: true },
  { path: '/doctors', label: 'Doctors', module: 'doctors', icon: '🩺', platformOnly: true },
];
