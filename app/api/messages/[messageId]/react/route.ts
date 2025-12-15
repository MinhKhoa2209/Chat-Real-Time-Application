import { NextResponse } from "next/server";
import getCurrentUser from "@/app/actions/getCurrentUser";
import prisma from "@/app/libs/prismadb";
import { pusherServer } from "@/app/libs/pusher";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const startTime = Date.now();
    const currentUser = await getCurrentUser();
    const { messageId } = await params;
    const body = await request.json();
    const { content } = body;

    console.log(`[REACT] Start - messageId: ${messageId}, content: ${content}`);

    if (!currentUser?.id || !content || !messageId) {
      return new NextResponse("Invalid data", { status: 400 });
    }

    // Check if message exists first
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true },
    });

    if (!message) {
      console.log(`[REACT] Message not found: ${messageId}`);
      return new NextResponse("Message not found", { status: 404 });
    }

    const existingReaction = await prisma.reaction.findFirst({
      where: {
        userId: currentUser.id,
        messageId: messageId,
      },
    });

    let reaction;
    let action = "created";

    if (existingReaction) {
      if (existingReaction.content === content) {
        await prisma.reaction.delete({ where: { id: existingReaction.id } });
        action = "deleted";
      } else {
        reaction = await prisma.reaction.update({
          where: { id: existingReaction.id },
          data: { content },
        });
        action = "updated";
      }
    } else {
      reaction = await prisma.reaction.create({
        data: {
          content,
          userId: currentUser.id,
          messageId: messageId,
        },
      });
    }

    console.log(`[REACT] Reaction ${action} in ${Date.now() - startTime}ms`);

    // Get only necessary data for Pusher
    const reactions = await prisma.reaction.findMany({
      where: { messageId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    // Send minimal update via Pusher
    const pusherPayload = {
      id: messageId,
      reactions: reactions.map((r) => ({
        id: r.id,
        content: r.content,
        user: r.user,
      })),
    };

    // Fire and forget
    pusherServer.trigger(
      message.conversationId,
      "message:update",
      pusherPayload
    ).catch((err) => console.error("[REACT] Pusher error:", err));

    console.log(`[REACT] Complete in ${Date.now() - startTime}ms`);
    return NextResponse.json(reaction || { status: "deleted" });
  } catch (error) {
    console.error("[REACT] Error:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}