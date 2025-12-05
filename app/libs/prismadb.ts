import { PrismaClient } from "@prisma/client";

declare global {
    var prisma: PrismaClient | undefined;
}

const client = globalThis.prisma || new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

// Handle connection errors
client.$connect().catch((err) => {
  console.error("Failed to connect to database:", err);
});

// Graceful shutdown
if (process.env.NODE_ENV === "production") {
  process.on("beforeExit", async () => {
    await client.$disconnect();
  });
}

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = client;
}

export default client;