import getCurrentUser from "@/app/actions/getCurrentUser";
import { NextResponse } from "next/server";
import prisma from "@/app/libs/prismadb";
import { pusherServer } from "@/app/libs/pusher";

interface IParams {
  conversationId: string;
}

export async function POST(
  request: Request,
  context: { params: Promise<IParams> }
) {
  try {
    const currentUser = await getCurrentUser();
    const { conversationId } = await context.params;

    if (!currentUser?.id || !currentUser?.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get ALL messages that user hasn't seen (not just the last one)
    const unseenMessages = await prisma.message.findMany({
      where: {
        conversationId,
        NOT: {
          seenIds: { has: currentUser.id },
        },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (unseenMessages.length === 0) {
      return NextResponse.json({ success: true });
    }

    // Update ALL unseen messages
    const updatePromises = unseenMessages.map(msg =>
      prisma.message.update({
        where: { id: msg.id },
        data: {
          seenIds: { push: currentUser.id },
        },
        select: {
          id: true,
          seenIds: true,
          seen: { select: { id: true, name: true, email: true, image: true } },
          senderId: true,
        },
      })
    );

    const updatedMessages = await Promise.all(updatePromises);
    const lastUpdatedMessage = updatedMessages[0]; // Most recent

    // Get conversation users for notification
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        users: { select: { email: true } },
      },
    });

    // Send update with full seen user data for "Seen by..." display
    const seenUpdate = {
      id: lastUpdatedMessage.id,
      seenIds: lastUpdatedMessage.seenIds,
      seen: lastUpdatedMessage.seen,
    };

    // Conversation update for unread count - include all updated messages
    const conversationUpdate = {
      id: conversationId,
      messages: updatedMessages.map(msg => ({
        id: msg.id,
        seenIds: msg.seenIds,
        seen: msg.seen,
        senderId: msg.senderId,
      })),
    };

    // Fire and forget Pusher notifications
    const pusherPromises = [
      pusherServer.trigger(conversationId, "message:update", seenUpdate),
    ];

    // Notify ALL users about seen status (including current user for unread count update)
    if (conversation?.users) {
      for (const user of conversation.users) {
        if (user.email) {
          pusherPromises.push(
            pusherServer.trigger(user.email, "conversation:update", conversationUpdate)
          );
        }
      }
    }

    Promise.all(pusherPromises).catch(() => {});

    return NextResponse.json({ success: true, updatedCount: updatedMessages.length });
  } catch (error) {
    console.error("ERROR_SEEING_MESSAGE:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
