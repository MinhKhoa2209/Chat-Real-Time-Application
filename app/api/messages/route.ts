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

    // Get conversation before update to check who deleted it
    const conversationBeforeUpdate = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { deletedForIds: true },
    });
    const usersWhoDeleted = conversationBeforeUpdate?.deletedForIds || [];

    // Update conversation lastMessageAt and restore if deleted
    const [updatedConversation] = await Promise.all([
      prisma.conversation.update({
        where: { id: conversationId },
        data: { 
          lastMessageAt: new Date(),
        },
        select: { 
          users: { select: { email: true, id: true } }, 
          lastMessageAt: true,
          deletedForIds: true,
          id: true,
          name: true,
          isGroup: true,
        },
      }),
    ]);

    // Remove all users from deletedForIds using MongoDB $set
    await prisma.$runCommandRaw({
      update: "Conversation",
      updates: [
        {
          q: { _id: { $oid: conversationId } },
          u: { $set: { deletedForIds: [] } },
        },
      ],
    });

    try {
      // Reduce payload size for Pusher (max 10KB)
      const pusherPayload = {
        ...newMessage,
        // Remove sensitive/large data
        sender: {
          id: newMessage.sender.id,
          name: newMessage.sender.name,
          email: newMessage.sender.email,
          image: newMessage.sender.image,
        },
        seen: newMessage.seen.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          image: u.image,
        })),
        reactions: newMessage.reactions.map(r => ({
          ...r,
          user: {
            id: r.user.id,
            name: r.user.name,
            email: r.user.email,
            image: r.user.image,
          }
        })),
        replyTo: newMessage.replyTo ? {
          id: newMessage.replyTo.id,
          body: newMessage.replyTo.body,
          image: newMessage.replyTo.image,
          sender: {
            id: newMessage.replyTo.sender.id,
            name: newMessage.replyTo.sender.name,
          }
        } : null,
        forwardedFrom: newMessage.forwardedFrom ? {
          id: newMessage.forwardedFrom.id,
          name: newMessage.forwardedFrom.name,
        } : null,
      };

      // Trigger Pusher events in parallel
      const pusherPromises = [
        pusherServer.trigger(conversationId, "messages:new", pusherPayload),
      ];

      // For conversation list, send last message only (not full conversation)
      const conversationUpdate = {
        id: conversationId,
        lastMessageAt: updatedConversation.lastMessageAt,
        messages: [{
          id: newMessage.id,
          body: newMessage.body,
          image: newMessage.image,
          fileUrl: newMessage.fileUrl,
          fileName: newMessage.fileName,
          fileSize: newMessage.fileSize,
          createdAt: newMessage.createdAt,
          senderId: newMessage.senderId,
          isDeleted: false,
          sender: {
            id: newMessage.sender.id,
            name: newMessage.sender.name,
            email: newMessage.sender.email,
            image: newMessage.sender.image,
          },
          seen: newMessage.seen.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            image: u.image,
          })),
          reactions: [],
          replyTo: pusherPayload.replyTo,
          forwardedFrom: pusherPayload.forwardedFrom,
        }],
      };

      // Add conversation updates for all users
      for (const user of updatedConversation.users) {
        if (user.email) {
          // If user had deleted conversation, send conversation:new to restore it
          if (usersWhoDeleted.includes(user.id)) {
            // Fetch full conversation to restore
            const fullConversation = await prisma.conversation.findUnique({
              where: { id: conversationId },
              include: {
                users: true,
                messages: {
                  take: 1,
                  orderBy: { createdAt: 'desc' },
                  include: {
                    sender: true,
                    seen: true,
                  },
                },
              },
            });
            
            if (fullConversation) {
              pusherPromises.push(
                pusherServer.trigger(user.email, "conversation:new", fullConversation)
              );
            }
          } else {
            pusherPromises.push(
              pusherServer.trigger(user.email, "conversation:update", conversationUpdate)
            );
          }
        }
      }

      // Execute all Pusher triggers in parallel
      await Promise.all(pusherPromises);
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