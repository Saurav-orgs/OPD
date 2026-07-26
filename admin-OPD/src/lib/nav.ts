import type { PermModule } from '../api/types';

export interface NavItem {
  path: string;
  label: string;
  module: PermModule; // sidebar shows only modules the role can `read`
  icon: string;
}

/** Sidebar config — rendered dynamically from the user's read permissions. */
export const NAV: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', module: 'dashboard', icon: '▦' },
  { path: '/appointments', label: 'Appointments', module: 'appointments', icon: '🗓' },
  { path: '/doctors', label: 'Doctors', module: 'doctors', icon: '🩺' },
  { path: '/users', label: 'Users', module: 'users', icon: '👤' },
  { path: '/roles', label: 'Roles', module: 'roles', icon: '🔑' },
];
