import { SubscriptionCacheService } from '../core/subscriptions/subscription-cache.service';
import { TenantAccessGuard } from '../core/subscriptions/tenant-access-guard.service';
import { TenantConnectionManager } from '../core/tenancy/tenant-connection-manager.service';

import { InMemorySubscriptionLoader } from '../infrastructure/subscriptions/in-memory-subscription.loader';
import { InMemoryTenantConfigRepository } from '../infrastructure/tenancy/in-memory-tenant-config.repository';
// 1. Importamos la nueva fábrica real de Prisma
import { PrismaTenantConnectionFactory } from '../infrastructure/tenancy/prisma-tenant-connection.factory';

import { UserRepository } from '../modules/users/repositories/user.repository';
import { UserService } from '../modules/users/services/user.service';

// --- Subscripciones / Feature flags ---
const subscriptionLoader = new InMemorySubscriptionLoader();
const subscriptionCache = new SubscriptionCacheService(subscriptionLoader);
export const tenantAccessGuard = new TenantAccessGuard(subscriptionCache);

// --- Conexiones por tenant ---
const tenantConfigRepository = new InMemoryTenantConfigRepository();
// 2. Instanciamos la fábrica de Prisma en lugar de la fake
const tenantConnectionFactory = new PrismaTenantConnectionFactory();
export const tenantConnectionManager = new TenantConnectionManager(
  tenantConfigRepository,
  tenantConnectionFactory,
);

// --- Módulo Users (ejemplo de negocio) ---
export const userRepository = new UserRepository(tenantConnectionManager);
export const userService = new UserService(userRepository);

/** Debe llamarse una vez al arrancar la app, antes de aceptar tráfico. */
export async function bootstrapSubscriptions(): Promise<void> {
  await subscriptionCache.warmUp();
}