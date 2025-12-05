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

    if (!currentUser?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const existingMessage = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!existingMessage) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Add current user to hiddenForIds using raw MongoDB operation
    await prisma.$runCommandRaw({
      update: "Message",
      updates: [
        {
          q: { _id: { $oid: messageId } },
          u: { $addToSet: { hiddenForIds: currentUser.id } },
        },
      ],
    });

    const updatedMessage = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: true,
        seen: true,
        reactions: { include: { user: true } },
        replyTo: { include: { sender: true } },
        forwardedFrom: true,
      },
    });

    if (updatedMessage) {
      await pusherServer.trigger(
        updatedMessage.conversationId,
        "message:hide",
        {
          messageId: updatedMessage.id,
          userId: currentUser.id,
        }
      );
    }

    return NextResponse.json(updatedMessage);
  } catch (error) {
    console.log(error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
