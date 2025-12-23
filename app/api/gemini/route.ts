
import { NextResponse } from "next/server";
import prisma from "@/app/libs/prismadb";
import { pusherServer } from "@/app/libs/pusher";
import { AIService } from "@/app/libs/ai-service";


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, conversationId, userId } = body;

    console.log('[GEMINI] Request received:', { message: message?.substring(0, 50), conversationId, userId });

    if (!message || !conversationId) {
      console.error('[GEMINI] Missing required fields');
      return new NextResponse("Missing required fields", { status: 400 });
    }

    let aiMessages;
    try {
      aiMessages = await AIService.generateResponse(userId, message);
      console.log('[GEMINI] AI generated', aiMessages.length, 'messages');
    } catch (aiError: any) {
      console.error('[GEMINI] AI generation error:', aiError);
      // Return error message instead of failing completely
      aiMessages = ["Sorry, I'm experiencing some issues right now. Please try again later!"];
    }

    const AI_BOT_ID = "6926f7de1fca804c3b97f53c"; 

    // Get conversation users for Pusher updates
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        users: { select: { id: true, name: true, email: true, image: true } },
        name: true,
        isGroup: true,
        image: true,
      },
    });

    // Create and send each message with small delay to feel more natural
    const createdMessages = [];
    for (let i = 0; i < aiMessages.length; i++) {
      const messageText = aiMessages[i];
      
      // Delay between messages (except first message)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Check if this is image data or image URL
      const isImageData = messageText.startsWith("IMAGE_DATA:");
      const isImageUrl = messageText.startsWith("IMAGE_URL:");
      
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
      } else if (isImageUrl) {
        // Handle image URL from Pollinations.ai
        const imageUrl = messageText.replace("IMAGE_URL:", "");
        messageData.image = imageUrl;
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

      console.log('[GEMINI] Message created:', newMessage.id);

      // Update conversation lastMessageAt
      const updatedConversation = await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
        select: {
          lastMessageAt: true,
        },
      });

      console.log('[GEMINI] Conversation updated:', updatedConversation.lastMessageAt);

      // Trigger Pusher for message
      try {
        await pusherServer.trigger(conversationId, "messages:new", newMessage);
        console.log('[GEMINI] Pusher messages:new triggered');
      } catch (pusherError) {
        console.error('[GEMINI] Pusher messages:new error:', pusherError);
      }
      
      // Send conversation:update to all users for conversation list
      if (conversation?.users) {
        const conversationUpdate = {
          id: conversationId,
          name: conversation.name,
          isGroup: conversation.isGroup,
          image: conversation.image,
          users: conversation.users,
          lastMessageAt: new Date(),
          messages: [{
            id: newMessage.id,
            body: newMessage.body,
            image: newMessage.image,
            fileUrl: null,
            fileName: null,
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
            })),
            reactions: [],
          }],
        };

        try {
          const pusherPromises = conversation.users
            .filter(user => user.email)
            .map(user => pusherServer.trigger(user.email!, "conversation:update", conversationUpdate));
          
          await Promise.all(pusherPromises);
          console.log('[GEMINI] Pusher conversation:update triggered for', conversation.users.length, 'users');
        } catch (pusherError) {
          console.error('[GEMINI] Pusher conversation:update error:', pusherError);
        }
      }
      
      createdMessages.push(newMessage);
    }

    console.log('[GEMINI] All messages sent successfully:', createdMessages.length);

    return NextResponse.json({ 
      success: true, 
      messages: createdMessages,
      count: createdMessages.length 
    });
  } catch (error: any) {
    console.error("[AI_ERROR]", error);
    console.error("[AI_ERROR] Stack:", error.stack);
    return new NextResponse(error.message || "Internal Error", { status: 500 });
  }
}