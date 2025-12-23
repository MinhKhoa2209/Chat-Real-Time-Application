import getCurrentUser from "@/app/actions/getCurrentUser";
import prisma from "@/app/libs/prismadb";
import { pusherServer } from "@/app/libs/pusher";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    const body = await request.json();
    const {
      message,
      image,
      conversationId,
      replyToId,
      fileUrl,
      fileName,
      fileSize,
      forwardedFromId,
    } = body;

    if (!currentUser?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const newMessage = await prisma.message.create({
      data: {
        body: message,
        image: image || undefined,
        conversation: {
          connect: {
            id: conversationId,
          },
        },
        fileUrl: fileUrl || undefined,
        fileName: fileName || undefined,
        fileSize: fileSize || undefined,
        sender: {
          connect: {
            id: currentUser.id,
          },
        },
        seen: {
          connect: {
            id: currentUser.id,
          },
        },
        ...(replyToId && {
          replyTo: {
            connect: {
              id: replyToId,
            },
          },
        }),
        ...(forwardedFromId && {
          forwardedFrom: {
            connect: {
              id: forwardedFromId,
            },
          },
        }),
      },
      include: {
        seen: true,
        sender: true,
        reactions: {
          include: {
            user: true,
          },
        },
        replyTo: {
          include: {
            sender: true,
          },
        },
        forwardedFrom: true,
      },
    });

    // Update conversation lastMessageAt
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
      select: { 
        users: { select: { id: true, name: true, email: true, image: true } }, 
        lastMessageAt: true,
        name: true,
        isGroup: true,
        image: true,
        deletedForIds: true,
      },
    });

    // Clear deletedForIds if any users had deleted this conversation
    // (so they will see it again with new messages)
    if (updatedConversation.deletedForIds && updatedConversation.deletedForIds.length > 0) {
      await prisma.$runCommandRaw({
        update: "Conversation",
        updates: [
          {
            q: { _id: { $oid: conversationId } },
            u: { $set: { deletedForIds: [] } },
          },
        ],
      });
    }

    try {
      // Reduce payload size for Pusher (max 10KB)
      const pusherPayload = {
        id: newMessage.id,
        body: newMessage.body,
        image: newMessage.image,
        fileUrl: newMessage.fileUrl,
        fileName: newMessage.fileName,
        fileSize: newMessage.fileSize,
        createdAt: newMessage.createdAt,
        conversationId: newMessage.conversationId,
        senderId: newMessage.senderId,
        sender: {
          id: newMessage.sender.id,
          name: newMessage.sender.name,
          email: newMessage.sender.email,
          image: newMessage.sender.image,
        },
        seen: newMessage.seen.map(u => ({
          id: u.id,
          email: u.email,
        })),
        seenIds: newMessage.seen.map(u => u.id),
        replyTo: newMessage.replyTo ? {
          id: newMessage.replyTo.id,
          body: newMessage.replyTo.body?.substring(0, 100),
          sender: {
            id: newMessage.replyTo.sender.id,
            name: newMessage.replyTo.sender.name,
          }
        } : null,
        forwardedFrom: newMessage.forwardedFrom ? {
          id: newMessage.forwardedFrom.id,
        } : null,
      };

      // Trigger message to conversation channel
      await pusherServer.trigger(conversationId, "messages:new", pusherPayload);

      // Minimal conversation update payload for sidebar
      const conversationUpdate = {
        id: conversationId,
        lastMessageAt: updatedConversation.lastMessageAt,
        isGroup: updatedConversation.isGroup,
        messages: [{
          id: newMessage.id,
          body: newMessage.body?.substring(0, 100), // Truncate for preview
          image: newMessage.image ? true : null, // Just flag, not full URL
          fileUrl: newMessage.fileUrl ? true : null,
          fileName: newMessage.fileName,
          createdAt: newMessage.createdAt,
          senderId: newMessage.senderId,
          sender: {
            id: newMessage.sender.id,
            name: newMessage.sender.name,
            email: newMessage.sender.email,
          },
          seen: newMessage.seen.map(u => ({
            id: u.id,
            email: u.email,
          })),
          seenIds: newMessage.seen.map(u => u.id),
        }],
      };

      // Send conversation updates to all users in parallel
      const updatePromises = updatedConversation.users
        .filter(user => user.email)
        .map(user => 
          pusherServer.trigger(user.email!, "conversation:update", conversationUpdate)
            .catch(err => console.error(`Pusher error for ${user.email}:`, err.message))
        );

      await Promise.all(updatePromises);
    } catch (pusherError) {
      console.error("Pusher error on new message:", pusherError);
      // Continue even if pusher fails
    }

    return NextResponse.json(newMessage);
  } catch (error: any) {
    console.log(error, "ERROR_MESSAGES");
    return new NextResponse("InternalError", { status: 500 });
  }
}