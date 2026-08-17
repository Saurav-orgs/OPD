/**
 * Defines the per-tenant role templates seeded at registration.
 * Each entry lists the (module, action) pairs to grant. Permission IDs
 * are resolved at runtime from the global permissions catalog.
 */
export interface RoleTemplate {
  name: string;
  description: string;
  isSystem: boolean;
  grants: Array<{ module: string; action: string }>;
}

const ALL_ACTIONS = ['create', 'read', 'update', 'delete'] as const;
const DOCTOR_MODULES = ['doctors', 'opd_schedules', 'appointments', 'dashboard', 'tenant'];
const NURSE_MODULES = ['appointments', 'dashboard'];

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    name: 'Owner',
    description: 'Practice owner. Full access within this practice.',
    isSystem: true,
    grants: [
      'users', 'roles', 'doctors', 'opd_schedules', 'appointments', 'dashboard', 'tenant',
    ].flatMap((module) => ALL_ACTIONS.map((action) => ({ module, action }))),
  },
  {
    name: 'Nurse / Front Desk',
    description: 'Manages appointments and patient check-in.',
    isSystem: false,
    grants: [
      ...NURSE_MODULES.flatMap((module) => ['read', 'update'].map((action) => ({ module, action }))),
    ],
  },
];
