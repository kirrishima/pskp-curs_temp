const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ROLES = ['user', 'manager', 'admin'];

async function main() {
  console.log('Seeding roles...');

  for (const name of ROLES) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    console.log(`  Role "${name}" — OK`);
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
