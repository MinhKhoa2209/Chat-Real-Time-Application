
import { NextResponse } from "next/server";
import prisma from "@/app/libs/prismadb";
import { pusherServer } from "@/app/libs/pusher";
import { AIService } from "@/app/libs/ai-service";


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, conversationId, userId } = body;

    const aiMessages = await AIService.generateResponse(userId, message);
    AIService.processAutoMemory(userId, message).catch((err) =>
      console.error("Auto Memory Error:", err)
    );

    const AI_BOT_ID = "6926f7de1fca804c3b97f53c"; 

    // Create and send each message with small delay to feel more natural
    const createdMessages = [];
    for (let i = 0; i < aiMessages.length; i++) {
      const messageText = aiMessages[i];
      
      // Delay between messages (except first message)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Check if this is image data
      const isImageData = messageText.startsWith("IMAGE_DATA:");
      
      let messageData: any = {
        conversationId,
        senderId: AI_BOT_ID,
        seenIds: [AI_BOT_ID],
      };

      if (isImageData) {
        // Handle image - save base64 to image field
        const imageBase64 = messageText.replace("IMAGE_DATA:", "");
        messageData.image = imageBase64;
        messageData.body = null;
      } else {
        // Regular text message
        messageData.body = messageText;
      }

      const newMessage = await prisma.message.create({
        data: messageData,
        include: {
          seen: true,
          sender: true,
          reactions: {
            include: {
              user: true,
            },
          },
        },
      });

      await pusherServer.trigger(conversationId, "messages:new", newMessage);
      createdMessages.push(newMessage);
    }

    return NextResponse.json({ 
      success: true, 
      messages: createdMessages,
      count: createdMessages.length 
    });
  } catch (error: any) {
    console.error("[AI_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}