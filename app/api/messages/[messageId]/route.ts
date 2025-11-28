import { NextResponse } from "next/server";
import getCurrentUser from "@/app/actions/getCurrentUser";
import prisma from "@/app/libs/prismadb";
import { pusherServer } from "@/app/libs/pusher";

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
        body: "Tin nhắn đã bị thu hồi",
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
      },
    });

    await pusherServer.trigger(
        updatedMessage.conversationId,
        "message:update",
        updatedMessage
    );

    return NextResponse.json(updatedMessage);
  } catch (error) {
    console.log(error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}