
import { NextResponse } from "next/server";
import prisma from "@/app/libs/prismadb";
import { pusherServer } from "@/app/libs/pusher";
import { AIService } from "@/app/libs/ai-service";


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, conversationId, userId } = body;

    const aiText = await AIService.generateResponse(userId, message);
    AIService.processAutoMemory(userId, message).catch((err) =>
      console.error("Auto Memory Error:", err)
    );

    const AI_BOT_ID = "6926f7de1fca804c3b97f53c"; 

    const newMessage = await prisma.message.create({
      data: {
        body: aiText,
        conversationId,
        senderId: AI_BOT_ID,
        seenIds: [AI_BOT_ID],
      },
      include: {
        seen: true,
        sender: true,
      },
    });

    await pusherServer.trigger(conversationId, "messages:new", newMessage);

    return NextResponse.json(newMessage);
  } catch (error: any) {
    console.error("[AI_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}