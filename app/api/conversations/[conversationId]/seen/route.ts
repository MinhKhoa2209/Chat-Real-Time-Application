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

    // Get only the last message that user hasn't seen
    const lastMessage = await prisma.message.findFirst({
      where: {
        conversationId,
        NOT: {
          seenIds: { has: currentUser.id },
        },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!lastMessage) {
      return NextResponse.json({ success: true });
    }

    // Update only the last message (batch update for efficiency)
    const updatedMessage = await prisma.message.update({
      where: { id: lastMessage.id },
      data: {
        seenIds: { push: currentUser.id },
      },
      select: {
        id: true,
        seenIds: true,
        seen: { select: { id: true, name: true, email: true, image: true } },
        senderId: true,
      },
    });

    // Get conversation users for notification
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        users: { select: { email: true } },
      },
    });

    // Send update with full seen user data for "Seen by..." display
    const seenUpdate = {
      id: updatedMessage.id,
      seenIds: updatedMessage.seenIds,
      seen: updatedMessage.seen,
    };

    // Conversation update for unread count
    const conversationUpdate = {
      id: conversationId,
      messages: [{
        id: updatedMessage.id,
        seenIds: updatedMessage.seenIds,
        seen: updatedMessage.seen,
        senderId: updatedMessage.senderId,
      }],
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("ERROR_SEEING_MESSAGE:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
