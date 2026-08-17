import { ModelStatic, Model } from 'sequelize';
import { getTenantContext } from './tenant-context';

/**
 * Registers Sequelize lifecycle hooks on a tenant-owned model so that
 * tenant_id is automatically injected/filtered for every query.
 *
 * The only escape hatch is { crossTenant: true } in the query options,
 * used exclusively by:
 *  - PublicController (unauthenticated patient endpoints)
 *  - PlatformController (super_admin across tenants)
 *  - Seeders / migrations
 *
 * The hooks run even when isPlatform = true — the guard keeps non-platform
 * tokens out before they reach the service layer.
 */
export function registerTenantHooks(model: ModelStatic<Model>): void {
  // ── Reads ────────────────────────────────────────────────────
  model.addHook('beforeFind', (options: any) => {
    if (options.crossTenant) return;
    const { tenantId, isPlatform } = getTenantContext();
    if (isPlatform) return; // super_admin sees all
    if (!tenantId) return;
    options.where = options.where ?? {};
    options.where.tenant_id = tenantId;
  });

  // ── Creates ──────────────────────────────────────────────────
  model.addHook('beforeCreate', (instance: any, options: any) => {
    if (options.crossTenant) return;
    const { tenantId, isPlatform } = getTenantContext();
    if (isPlatform) return;
    if (tenantId && !instance.tenant_id) {
      instance.tenant_id = tenantId;
    }
  });

  model.addHook('beforeBulkCreate', (instances: any[], options: any) => {
    if (options.crossTenant) return;
    const { tenantId, isPlatform } = getTenantContext();
    if (isPlatform) return;
    if (!tenantId) return;
    for (const inst of instances) {
      if (!inst.tenant_id) inst.tenant_id = tenantId;
    }
  });

  // ── Updates ──────────────────────────────────────────────────
  model.addHook('beforeBulkUpdate', (options: any) => {
    if (options.crossTenant) return;
    const { tenantId, isPlatform } = getTenantContext();
    if (isPlatform) return;
    if (!tenantId) return;
    options.where = options.where ?? {};
    options.where.tenant_id = tenantId;
  });

  // ── Deletes ──────────────────────────────────────────────────
  model.addHook('beforeBulkDestroy', (options: any) => {
    if (options.crossTenant) return;
    const { tenantId, isPlatform } = getTenantContext();
    if (isPlatform) return;
    if (!tenantId) return;
    options.where = options.where ?? {};
    options.where.tenant_id = tenantId;
  });
}
