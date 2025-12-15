import { NextResponse } from "next/server";
import prisma from "@/app/libs/prismadb";
import getCurrentUser from "@/app/actions/getCurrentUser";
import { pusherServer } from "@/app/libs/pusher";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { conversationId, callType, callStatus, duration } = body;

    if (!conversationId || !callType || !callStatus) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Build call message body
    let messageBody = "";
    const callIcon = callType === "video" ? "📹" : "📞";
    
    switch (callStatus) {
      case "missed":
        messageBody = `${callIcon} Missed ${callType} call`;
        break;
      case "rejected":
        messageBody = `${callIcon} ${callType.charAt(0).toUpperCase() + callType.slice(1)} call declined`;
        break;
      case "ended":
        if (duration && duration > 0) {
          const mins = Math.floor(duration / 60);
          const secs = duration % 60;
          const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
          messageBody = `${callIcon} ${callType.charAt(0).toUpperCase() + callType.slice(1)} call • ${durationStr}`;
        } else {
          messageBody = `${callIcon} ${callType.charAt(0).toUpperCase() + callType.slice(1)} call`;
        }
        break;
      default:
        messageBody = `${callIcon} ${callType.charAt(0).toUpperCase() + callType.slice(1)} call`;
    }

    // Create message and update conversation in parallel
    const [message, updatedConversation] = await Promise.all([
      prisma.message.create({
        data: {
          body: messageBody,
          conversationId,
          senderId: currentUser.id,
          seenIds: [currentUser.id],
        },
        include: {
          sender: { select: { id: true, name: true, email: true, image: true } },
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
        include: {
          users: { select: { id: true, name: true, email: true, image: true } },
        },
      }),
    ]);

    // Get full conversation data to include name, isGroup, image
    const fullConversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        name: true,
        isGroup: true,
        image: true,
      },
    });

    // Notify via Pusher (non-blocking, parallel)
    const minimalMessage = {
      id: message.id,
      body: message.body,
      senderId: message.senderId,
      conversationId: message.conversationId,
      createdAt: message.createdAt,
      sender: message.sender,
      seen: [],
      image: null,
      fileUrl: null,
    };
    
    const conversationUpdate = {
      id: updatedConversation.id,
      name: fullConversation?.name || null,
      isGroup: fullConversation?.isGroup || false,
      image: fullConversation?.image || null,
      users: updatedConversation.users,
      messages: [{
        ...minimalMessage,
        seenIds: [currentUser.id],
      }],
      lastMessageAt: updatedConversation.lastMessageAt,
    };

    // Fire and forget - don't wait for Pusher
    Promise.all([
      pusherServer.trigger(conversationId, "messages:new", minimalMessage),
      ...updatedConversation.users
        .filter(u => u.email)
        .map(u => pusherServer.trigger(u.email!, "conversation:update", conversationUpdate))
    ]).catch((err) => console.error("[CALL_MESSAGE] Pusher error:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CALL_MESSAGE] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
