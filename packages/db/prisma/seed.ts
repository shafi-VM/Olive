import { PrismaClient } from '../src/generated/client/index.js';

/**
 * Optional seed: a single welcome conversation so the UI is not empty on a
 * fresh install. Safe to run repeatedly — it no-ops if data already exists.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const existing = await prisma.conversation.count();
  if (existing > 0) {
    console.log(`Seed skipped — ${existing} conversation(s) already present.`);
    return;
  }

  await prisma.conversation.create({
    data: {
      title: 'Welcome to Olive',
      provider: 'mock',
      model: 'mock-1',
      messages: {
        create: [
          { role: 'user', content: 'Hello!', sequence: 0 },
          {
            role: 'assistant',
            content: 'Hi! I am a demo assistant. Inference logs stream to the dashboard.',
            sequence: 1,
          },
        ],
      },
    },
  });
  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
