import { AsyncLocalStorage } from 'async_hooks';

export interface TenantStore {
  tenantId: string | null; // null for platform super_admin
  isPlatform: boolean;
}

export const tenantStorage = new AsyncLocalStorage<TenantStore>();

export function getTenantContext(): TenantStore {
  const store = tenantStorage.getStore();
  // Outside of a request (seeder, tests) default to platform context.
  return store ?? { tenantId: null, isPlatform: true };
}
