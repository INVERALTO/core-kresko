# Kresko Core (avance)

Este paquete contiene lo diseñado hasta ahora del Core multi-tenant de Kresko:

1. **Contexto de tenant** (`TenantContext` sobre `AsyncLocalStorage`).
2. **Feature flags por suscripción** (`TenantAccessGuard`, `SubscriptionCacheService`, `TenantAccessDeniedException`).
3. **Aislamiento de conexión a base de datos por tenant** (`TenantConnectionManager`, `ITenantConfigRepository`, `ITenantConnectionFactory`, `IDbConnection`).
4. **`BaseRepository`** para resolución transparente de la conexión en repositorios de módulo.
5. **Middlewares Express** (`resolveTenant`, `requireModule`, `globalErrorHandler`) y un módulo de ejemplo (`users`).

Todas las implementaciones de infraestructura (`src/infrastructure/**`) son **mocks en memoria**, pensadas
solo para poder levantar el servidor y ensayar el flujo completo sin depender de una base de datos real
todavía. Cuando definan el driver/ORM real, solo hay que reemplazar esas clases (implementan los puertos
del Core, así que el resto del sistema no se entera del cambio).

## Requisitos

- Node.js 18+
- npm

## Instalación

```bash
npm install
```

## Ejecutar en modo desarrollo

```bash
npm run dev
```

Verás en consola algo como:

```
Kresko Core escuchando en http://localhost:3000
```

## Probar el flujo completo

El "tenant" se resuelve (por ahora, de forma simplificada) desde el header `x-tenant-id`.
Hay 3 tenants mock precargados en `InMemorySubscriptionLoader`:

| tenantId          | status    | enabledModules            | expiresAt   |
|--------------------|-----------|----------------------------|-------------|
| `tenant-acme`      | ACTIVE    | ventas, inventario          | sin expirar |
| `tenant-globex`    | TRIAL     | ventas                      | 2026-12-31  |
| `tenant-vencido`   | ACTIVE    | ventas, inventario          | 2020-01-01 (ya expiró) |

### 1. Acceso permitido

```bash
curl -H "x-tenant-id: tenant-acme" http://localhost:3000/inventario/stock
```

### 2. Módulo no habilitado (403)

```bash
curl -H "x-tenant-id: tenant-globex" http://localhost:3000/inventario/stock
```

Respuesta esperada:

```json
{
  "error": "FORBIDDEN",
  "message": "No tienes acceso al módulo \"inventario\".",
  "reason": "MODULE_NOT_ENABLED"
}
```

### 3. Suscripción expirada (403)

```bash
curl -H "x-tenant-id: tenant-vencido" http://localhost:3000/inventario/stock
```

### 4. Sin header de tenant (400)

```bash
curl http://localhost:3000/inventario/stock
```

### 5. Flujo end-to-end con conexión dinámica por tenant

```bash
curl -H "x-tenant-id: tenant-acme" http://localhost:3000/users/1
```

Esto pasa por: `resolveTenant` → `requireModule('ventas')` → `UserService` → `UserRepository`
(hereda de `BaseRepository`) → `TenantConnectionManager.getConnection('tenant-acme')` → conexión
simulada (`FakeTenantConnectionFactory`) → `IDbConnection.query()`.

En la consola del servidor verás los logs de la conexión simulada abriéndose (lazy, solo la primera
vez) y de la query ejecutándose.

## Próximos pasos sugeridos

- Reemplazar `InMemorySubscriptionLoader` por un loader real contra la DB central de administración.
- Reemplazar `InMemoryTenantConfigRepository` y `FakeTenantConnectionFactory` por implementaciones
  reales (ej. `pg.Pool`, `PrismaClient` por tenant, etc.).
- Tests unitarios de `TenantAccessGuard`, `TenantConnectionManager` y `BaseRepository`.
- `UnitOfWork` / manejo de transacciones multi-repositorio.
