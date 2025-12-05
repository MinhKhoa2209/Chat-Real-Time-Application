import { NextResponse } from "next/server";
import getCurrentUser from "@/app/actions/getCurrentUser";
import prisma from "@/app/libs/prismadb";
import { pusherServer } from "@/app/libs/pusher";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    const { messageId } = await params;
    const body = await request.json();
    const { body: newBody } = body;

    if (!currentUser?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!newBody || newBody.trim() === "") {
      return new NextResponse("Message body is required", { status: 400 });
    }

    const existingMessage = await prisma.message.findUnique({
      where: { id: messageId },
      include: { sender: true }
    });

    if (!existingMessage) {
      return new NextResponse("Not Found", { status: 404 });
    }

    if (existingMessage.senderId !== currentUser.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Cannot edit messages with images or files
    if (existingMessage.image || existingMessage.fileUrl) {
      return new NextResponse("Cannot edit messages with media", { status: 400 });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        body: newBody,
      },
      include: {
        sender: true,
        seen: true,
        reactions: { include: { user: true } },
        replyTo: { include: { sender: true } },
        forwardedFrom: true,
      },
    });

    // Trigger Pusher update (don't fail if Pusher fails)
    try {
      await pusherServer.trigger(
        updatedMessage.conversationId,
        "message:update",
        updatedMessage
      );
    } catch (pusherError) {
      console.error("Pusher trigger error:", pusherError);
      // Continue anyway - message was updated in DB
    }

    return NextResponse.json(updatedMessage);
  } catch (error: any) {
    console.error("Edit message error:", error);
    console.error("Error details:", error.message);
    return new NextResponse(error.message || "Internal Error", { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    const { messageId } = await params; 

    if (!currentUser?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const existingMessage = await prisma.message.findUnique({
      where: { id: messageId },
      include: { sender: true }
    });

    if (!existingMessage) {
      return new NextResponse("Not Found", { status: 404 });
    }
    if (existingMessage.senderId !== currentUser.id) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        body: "Message has been unsent",
        image: null,
        fileUrl: null,
        fileName: null,
        fileSize: null,
      },
      include: {
        sender: true,
        seen: true,
        reactions: { include: { user: true } },
        replyTo: { include: { sender: true } },
        forwardedFrom: true,
      },
    });

    // Trigger message update for current conversation
    try {
      // Reduce payload for Pusher
      const pusherPayload = {
        ...updatedMessage,
        sender: {
          id: updatedMessage.sender.id,
          name: updatedMessage.sender.name,
          email: updatedMessage.sender.email,
          image: updatedMessage.sender.image,
        },
        seen: updatedMessage.seen.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
        })),
      };

      await pusherServer.trigger(
        updatedMessage.conversationId,
        "message:update",
        pusherPayload
      );

      // Get conversation users
      const conversation = await prisma.conversation.findUnique({
        where: { id: updatedMessage.conversationId },
        include: { users: true },
      });

      // Trigger minimal conversation update
      if (conversation) {
        const conversationUpdate = {
          id: conversation.id,
          lastMessageAt: conversation.lastMessageAt,
          messages: [{
            id: updatedMessage.id,
            body: updatedMessage.body,
            isDeleted: updatedMessage.isDeleted,
            senderId: updatedMessage.senderId,
          }],
        };

        for (const user of conversation.users) {
          if (user.email) {
            await pusherServer.trigger(user.email, "conversation:update", conversationUpdate);
          }
        }
      }
    } catch (pusherError) {
      console.error("Pusher error on delete:", pusherError);
      // Continue even if pusher fails
    }

    return NextResponse.json(updatedMessage);
  } catch (error) {
    console.log(error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}