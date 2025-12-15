import { NextResponse } from "next/server";
import getCurrentUser from "@/app/actions/getCurrentUser";
import { pusherServer } from "@/app/libs/pusher";
import prisma from "@/app/libs/prismadb";

// Cache for user emails to reduce DB queries
const userEmailCache = new Map<string, { email: string; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

async function getUserEmail(userId: string): Promise<string | null> {
  const cached = userEmailCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.email;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (user?.email) {
    userEmailCache.set(userId, { email: user.email, timestamp: Date.now() });
    return user.email;
  }

  return null;
}

export async function POST(request: Request) {
  try {
    // Parse request body first (faster than auth check)
    const body = await request.json();
    const {
      type,
      targetUserId,
      payload,
      callId,
      callType,
      callerName,
      callerImage,
      conversationId,
      isGroup,
      groupName,
    } = body;

    // Validate required fields early
    if (!type || !targetUserId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Auth check
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get target user's email (with caching)
    console.log(`[CALL_SIGNAL] Looking up email for userId: ${targetUserId}`);
    const targetEmail = await getUserEmail(targetUserId);
    if (!targetEmail) {
      console.error(`[CALL_SIGNAL] User not found: ${targetUserId}`);
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }
    console.log(`[CALL_SIGNAL] Found email: ${targetEmail} for userId: ${targetUserId}`);

    // Build event data - minimal payload for faster transmission
    const eventData: Record<string, unknown> = {
      callId,
      callerId: currentUser.id,
      payload,
    };

    // Add extra data for offer only
    if (type === "offer") {
      eventData.callType = callType;
      eventData.callerName = callerName || currentUser.name;
      eventData.callerImage = callerImage || currentUser.image;
      eventData.conversationId = conversationId;
      eventData.isGroup = isGroup || false;
      if (groupName) eventData.groupName = groupName;
    }

    // Send via Pusher
    const eventName = `call:${type}`;
    console.log(`[CALL_SIGNAL] Sending ${eventName} to channel: ${targetEmail}`);
    
    try {
      await pusherServer.trigger(targetEmail, eventName, eventData);
      console.log(`[CALL_SIGNAL] Successfully sent ${eventName} to ${targetEmail}`);
    } catch (err) {
      console.error("[CALL_SIGNAL] Pusher error:", err);
      return NextResponse.json({ error: "Failed to send signal" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CALL_SIGNAL] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
