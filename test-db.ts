import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// 1. Crear el pool de conexión nativo de pg
const connectionString = "postgresql://postgres:Kresko0112233+@localhost:5432/kresko_admin?schema=public";
const pool = new Pool({ connectionString });

// 2. Crear el adaptador para Prisma
const adapter = new PrismaPg(pool);

// 3. Inicializar el cliente usando el adaptador
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("--- Iniciando prueba con Prisma 7 Adapter ---");
  
  try {
    const newUser = await prisma.user.create({
      data: {
        email: `test_${Date.now()}@kresko.com`,
        name: "Usuario de Prueba"
      },
    });
    console.log("✅ Éxito: Usuario creado con ID:", newUser.id);

    const user = await prisma.user.findUnique({
      where: { email: newUser.email }
    });
    console.log("✅ Éxito: Usuario leído correctamente:", user?.name);
  } catch (error) {
    console.error("❌ Error en la prueba:", error);
  } finally {
    await prisma.$disconnect();
    await pool.end(); // Cerrar el pool de pg
  }
}

main();