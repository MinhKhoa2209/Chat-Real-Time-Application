// Script to fix corrupted DateTime fields in MongoDB
// Run with: npx ts-node scripts/fix-datetime.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixDateTimeFields() {
  console.log("Starting DateTime fix...");

  try {
    // Get all conversations
    const conversations = await prisma.$runCommandRaw({
      find: "Conversation",
      filter: {},
    }) as any;

    console.log(`Found ${conversations.cursor?.firstBatch?.length || 0} conversations`);

    for (const conv of conversations.cursor?.firstBatch || []) {
      const id = conv._id.$oid || conv._id;
      const lastMessageAt = conv.lastMessageAt;

      // Check if lastMessageAt is a string instead of Date
      if (typeof lastMessageAt === "string") {
        console.log(`Fixing conversation ${id}: ${lastMessageAt}`);
        
        await prisma.$runCommandRaw({
          update: "Conversation",
          updates: [
            {
              q: { _id: { $oid: id } },
              u: { $set: { lastMessageAt: { $date: lastMessageAt } } },
            },
          ],
        });
      }
    }

    console.log("DateTime fix completed!");
  } catch (error) {
    console.error("Error fixing DateTime:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDateTimeFields();
