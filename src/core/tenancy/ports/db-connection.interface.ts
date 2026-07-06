import { PrismaClient } from '@prisma/client';

export interface IDbConnection {
  // Exponemos la instancia real de Prisma asignada a este inquilino
  prisma: PrismaClient;
  
  // Mantenemos el método close para cerrar conexiones gracefully cuando sea necesario
  close(): Promise<void>;
}