import { NextResponse } from "next/server";
import getCurrentUser from "@/app/actions/getCurrentUser";
import { pusherServer } from "@/app/libs/pusher";
import prisma from "@/app/libs/prismadb";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, targetUserId, payload, callId, callType, callerName, callerImage, conversationId } = body;

    // Get target user's email for Pusher channel
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { email: true },
    });

    if (!targetUser?.email) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    // Send signal via Pusher
    const eventData: any = {
      callId,
      payload,
      callerId: currentUser.id,
    };

    if (type === "offer") {
      eventData.callType = callType;
      eventData.callerName = callerName || currentUser.name;
      eventData.callerImage = callerImage || currentUser.image;
      eventData.conversationId = conversationId;
    }

    await pusherServer.trigger(targetUser.email, `call:${type}`, eventData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CALL_SIGNAL_ERROR:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
