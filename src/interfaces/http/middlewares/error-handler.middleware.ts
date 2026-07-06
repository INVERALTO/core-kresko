import { ErrorRequestHandler } from 'express';
import { TenantAccessDeniedException } from '../../../core/errors/tenant-access-denied.exception';
import { TenantConfigNotFoundException } from '../../../core/errors/tenant-config-not-found.exception';

export const globalErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof TenantAccessDeniedException) {
    res.status(err.httpStatus).json({
      error: 'FORBIDDEN',
      message: err.message,
      tenantId: err.tenantId,
      module: err.moduleKey,
      reason: err.reason,
    });
    return;
  }

  if (err instanceof TenantConfigNotFoundException) {
    res.status(404).json({
      error: 'TENANT_CONFIG_NOT_FOUND',
      message: err.message,
      tenantId: err.tenantId,
    });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'INTERNAL_ERROR' });
};
