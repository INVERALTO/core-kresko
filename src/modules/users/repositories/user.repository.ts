// El './' le dice a TypeScript que busque el archivo en esta misma carpeta 'repositories'
import { User } from '@prisma/client';

/* NOTA: Si por casualidad estás usando el tipo "User" que genera Prisma automáticamente 
  en lugar de uno creado por ti, borra la línea de arriba y usa esta:
  import { User } from '@prisma/client';
*/

export class UserRepository {
  private db: any; 

  constructor(db: any) {
    this.db = db;
  }

  public async findById(id: string): Promise<User | null> {
    const prisma = (this.db as any).prisma; 
    
    const foundUser = await prisma.user.findUnique({
      where: { 
        id: id
      }
    });

    return foundUser;
  }

  public async create(user: Omit<User, 'id'>): Promise<User> {
    const prisma = (this.db as any).prisma;
    
    const newUser = await prisma.user.create({
      data: user 
    });

    return newUser;
  }
}