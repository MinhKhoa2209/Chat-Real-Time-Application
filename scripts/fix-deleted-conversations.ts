// Script to fix conversations that don't have deletedForIds field
// Run with: npx ts-node scripts/fix-deleted-conversations.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Finding conversations without deletedForIds...");

  // Find all conversations
  const conversations = await prisma.conversation.findMany({
    select: {
      id: true,
      deletedForIds: true,
    },
  });

  console.log(`Found ${conversations.length} total conversations`);

  // Filter conversations that need fixing (deletedForIds is null or undefined)
  const needsFix = conversations.filter(
    (c) => !c.deletedForIds || !Array.isArray(c.deletedForIds)
  );

  console.log(`${needsFix.length} conversations need fixing`);

  if (needsFix.length === 0) {
    console.log("All conversations already have deletedForIds field!");
    return;
  }

  // Update each conversation
  for (const conv of needsFix) {
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { deletedForIds: [] },
    });
    console.log(`Fixed conversation: ${conv.id}`);
  }

  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
