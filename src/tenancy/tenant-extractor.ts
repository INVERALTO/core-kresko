import { assertValidTenantId, normalizeTenantId } from './tenant-id';

/**
 * Contrato que debe cumplir cualquier "origen" de tenantId.
 * Cada estrategia sabe leer UN tipo de input (payload JWT, request-like
 * object, mensaje de cola, etc.) y devuelve `undefined` si ese input
 * no trae el dato que busca — NUNCA lanza por "no encontrado", solo
 * por formato inválido (ver TenantExtractor.extract).
 */
export interface TenantIdSource {
  /** Nombre legible, útil para logs/depuración. */
  readonly name: string;
  tryExtract(input: unknown): string | undefined;
}

/** Extrae el tenantId de un claim de un payload JWT ya decodificado. */
export class JwtClaimTenantSource implements TenantIdSource {
  readonly name = 'jwt-claim';
  constructor(private readonly claimName: string = 'tenant_id') {}

  tryExtract(input: unknown): string | undefined {
    if (typeof input !== 'object' || input === null) return undefined;
    const value = (input as Record<string, unknown>)[this.claimName];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
}

/**
 * Extrae el tenantId de un objeto "request-like" con `.headers`.
 * Funciona tanto con http.IncomingMessage de Node como con objetos
 * planos que tú construyas en tu propio router.
 */
export class HttpHeaderTenantSource implements TenantIdSource {
  readonly name = 'http-header';
  constructor(private readonly headerName: string = 'x-tenant-id') {}

  tryExtract(input: unknown): string | undefined {
    const headers = (input as { headers?: Record<string, unknown> } | undefined)?.headers;
    if (!headers) return undefined;
    const value = headers[this.headerName] ?? headers[this.headerName.toLowerCase()];
    const raw = Array.isArray(value) ? value[0] : value;
    return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
  }
}

/**
 * Extrae el tenantId de un mensaje de cola, ya sea en el nivel raíz
 * (`{ tenantId: ... }`) o dentro de metadata (`{ metadata: { tenantId: ... } }`).
 */
export class QueueMessageTenantSource implements TenantIdSource {
  readonly name = 'queue-message';

  tryExtract(input: unknown): string | undefined {
    if (typeof input !== 'object' || input === null) return undefined;
    const obj = input as Record<string, unknown>;

    if (typeof obj.tenantId === 'string' && obj.tenantId.length > 0) {
      return obj.tenantId;
    }
    const metadata = obj.metadata;
    if (typeof metadata === 'object' && metadata !== null) {
      const nested = (metadata as Record<string, unknown>).tenantId;
      if (typeof nested === 'string' && nested.length > 0) return nested;
    }
    return undefined;
  }
}

export class TenantIdNotFoundError extends Error {
  constructor() {
    super(
      '[TenantExtractor] No se pudo extraer un tenantId de ninguno de los orígenes configurados.',
    );
    this.name = 'TenantIdNotFoundError';
  }
}

/**
 * Servicio inyectable: recibe una lista ordenada de TenantIdSource y
 * las prueba en orden. La primera que devuelva un valor (no undefined)
 * es AUTORITATIVA: se normaliza y se valida de inmediato.
 *
 * Decisión de seguridad importante: si una fuente devuelve un valor
 * pero ese valor NO pasa assertValidTenantId(), el flujo se detiene
 * ahí con un error — no se sigue probando con las fuentes siguientes.
 * Si se permitiera "caer" a una fuente más débil (p. ej. un header
 * fácilmente falsificable) cuando el JWT trae algo inválido, un
 * atacante podría forzar ese fallback a propósito. Fail-closed.
 */
export class TenantExtractor {
  constructor(private readonly sources: TenantIdSource[]) {}

  extract(input: unknown): string {
    for (const source of this.sources) {
      const raw = source.tryExtract(input);
      if (raw === undefined) continue; // esta fuente no aplica a este input, prueba la siguiente

      const normalized = normalizeTenantId(raw);
      assertValidTenantId(normalized); // lanza TenantValidationError si el formato no es válido
      return normalized;
    }
    throw new TenantIdNotFoundError();
  }

  /**
   * Configuración por defecto razonable: JWT primero (más confiable,
   * viene de un token verificado), luego header HTTP, luego mensaje
   * de cola. Ajusta el orden/lista según tu caso real con `new
   * TenantExtractor([...])`.
   */
  static default(): TenantExtractor {
    return new TenantExtractor([
      new JwtClaimTenantSource(),
      new HttpHeaderTenantSource(),
      new QueueMessageTenantSource(),
    ]);
  }
}
