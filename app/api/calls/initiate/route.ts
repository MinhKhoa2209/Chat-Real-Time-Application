import { NextResponse } from "next/server";
import prisma from "@/app/libs/prismadb";
import getCurrentUser from "@/app/actions/getCurrentUser";

export async function POST(request: Request) {
  try {
    // Parse body first (faster)
    const body = await request.json();
    const { callId, conversationId, type, isGroup, participantIds } = body;

    // Validate required fields early
    if (!callId || !conversationId || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!participantIds || participantIds.length === 0) {
      return NextResponse.json({ error: "No participants specified" }, { status: 400 });
    }

    // Auth check
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create call record - fire and forget for faster response
    prisma.call.create({
      data: {
        type,
        status: "ringing",
        callerId: currentUser.id,
        receiverId: participantIds[0],
        conversationId,
      },
    }).catch((err) => {
      console.error("[CALL_INITIATE] DB error:", err);
    });

    return NextResponse.json({ success: true, callId });
  } catch (error) {
    console.error("[CALL_INITIATE] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
