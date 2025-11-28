import { NextResponse } from "next/server";
import getCurrentUser from "@/app/actions/getCurrentUser";
import prisma from "@/app/libs/prismadb";
import { pusherServer } from "@/app/libs/pusher";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> } 
) {
  try {
    const currentUser = await getCurrentUser();
    const { messageId } = await params; 
    const body = await request.json();
    const { content } = body;

    if (!currentUser?.id || !content || !messageId) {
      return new NextResponse("Invalid data", { status: 400 });
    }

    const existingReaction = await prisma.reaction.findFirst({
      where: {
        userId: currentUser.id,
        messageId: messageId,
      },
    });

    let reaction;

    if (existingReaction) {
        if(existingReaction.content === content) {
             await prisma.reaction.delete({ where: { id: existingReaction.id } });
        } else {
            reaction = await prisma.reaction.update({
                where: { id: existingReaction.id },
                data: { content }
            });
        }
    } else {
      reaction = await prisma.reaction.create({
        data: {
          content,
          user: {
            connect: { id: currentUser.id }
          },
          message: {
            connect: { id: messageId }
          }
        },
      });
    }

    const updatedMessage = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: true,
        seen: true,
        reactions: { include: { user: true } },
        replyTo: { include: { sender: true } },
      },
    });

    if (updatedMessage) {
        await pusherServer.trigger(
            updatedMessage.conversationId,
            "message:update",
            updatedMessage
        );
    }

    return NextResponse.json(reaction || { status: "deleted" });
  } catch (error) {
    console.log(error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}