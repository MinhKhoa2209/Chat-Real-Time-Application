import { NextResponse } from "next/server";
import prisma from "@/app/libs/prismadb";
import getCurrentUser from "@/app/actions/getCurrentUser";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const calls = await prisma.call.findMany({
      where: {
        OR: [
          { callerId: currentUser.id },
          { receiverId: currentUser.id },
        ],
      },
      orderBy: {
        startedAt: "desc",
      },
      take: 50,
    });

    // Get user info for each call
    const userIds = [...new Set(calls.flatMap((c) => [c.callerId, c.receiverId]))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, image: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const callsWithUsers = calls.map((call) => ({
      ...call,
      caller: userMap.get(call.callerId),
      receiver: userMap.get(call.receiverId),
      isOutgoing: call.callerId === currentUser.id,
    }));

    return NextResponse.json(callsWithUsers);
  } catch (error) {
    console.error("CALL_HISTORY_ERROR:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
