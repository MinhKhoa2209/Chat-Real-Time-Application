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

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { 
          include: { seen: true },
          orderBy: { createdAt: 'asc' }
        },
        users: true,
      },
    });

    if (!conversation) {
      return new NextResponse("Invalid ID", { status: 400 });
    }

    // Get all unread messages for current user
    const unreadMessages = conversation.messages.filter(msg => 
      !msg.seen.some(user => user.id === currentUser.id)
    );



    // Mark all unread messages as seen and collect updated messages
    const updatedMessages = [];
    
    if (unreadMessages.length > 0) {
      try {
        for (const msg of unreadMessages) {
          const updated = await prisma.message.update({
            where: { id: msg.id },
            data: {
              seen: { connect: { id: currentUser.id } },
            },
            include: {
              sender: true,
              seen: true,
            },
          });
          updatedMessages.push(updated);
        }

      } catch (updateError) {
        console.error("Error updating messages:", updateError);
      }
    }

    // Get the last message
    const lastMessage = conversation.messages.at(-1);
    
    if (!lastMessage) {
      return NextResponse.json(conversation);
    }

    // If no messages were updated, get the last message
    if (updatedMessages.length === 0) {
      const msg = await prisma.message.findUnique({
        where: { id: lastMessage.id },
        include: {
          sender: true,
          seen: true,
        },
      });
      if (msg) updatedMessages.push(msg);
    }

    try {
      // Trigger message:update for all messages in parallel
      const messageUpdatePromises = updatedMessages.map(msg => {
        const pusherPayload = {
          ...msg,
          sender: {
            id: msg.sender.id,
            name: msg.sender.name,
            email: msg.sender.email,
            image: msg.sender.image,
          },
          seen: msg.seen.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            image: u.image,
          })),
        };

        return pusherServer.trigger(conversationId, "message:update", pusherPayload);
      });

      await Promise.all(messageUpdatePromises);

      // Get conversation users
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { users: true },
      });

      // Trigger conversation update with ALL updated messages
      if (conv && updatedMessages.length > 0) {
        const conversationUpdate = {
          id: conversationId,
          lastMessageAt: conv.lastMessageAt,
          messages: updatedMessages.map(msg => ({
            id: msg.id,
            body: msg.body,
            image: msg.image,
            fileUrl: msg.fileUrl,
            fileName: msg.fileName,
            createdAt: msg.createdAt,
            senderId: msg.senderId,
            isDeleted: msg.isDeleted,
            sender: {
              id: msg.sender.id,
              name: msg.sender.name,
              email: msg.sender.email,
              image: msg.sender.image,
            },
            seen: msg.seen.map(u => ({
              id: u.id,
              name: u.name,
              email: u.email,
              image: u.image,
            })),
            reactions: [],
          })),
        };

        // Trigger all users in parallel
        await Promise.all(
          conv.users
            .filter(user => user.email)
            .map(user => pusherServer.trigger(user.email!, "conversation:update", conversationUpdate))
        );
      }

    } catch (pusherError) {
      // Silent fail - don't block response
    }

    return NextResponse.json(updatedMessages);
  } catch (error) {
    console.error("ERROR_SEEING_MESSAGE:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
