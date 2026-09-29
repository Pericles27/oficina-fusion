import { PrismaClient, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Check if admin already exists
  const existing = await prisma.usuario.findUnique({ where: { username: 'admin' } });
  if (existing) {
    console.log('Admin user already exists, skipping seed');
    return;
  }

  // Create default admin user
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.usuario.create({
    data: {
      username: 'admin',
      passwordHash,
      nombre: 'Administrador',
      email: 'admin@oficina.local',
      roles: [RolUsuario.ADMIN],
      activo: true,
    },
  });

  console.log('Admin user created: admin / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
