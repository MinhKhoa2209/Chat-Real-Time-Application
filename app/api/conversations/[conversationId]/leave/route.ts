import getCurrentUser from "@/app/actions/getCurrentUser";
import { NextResponse } from "next/server";
import prisma from "@/app/libs/prismadb";
import { pusherServer } from "@/app/libs/pusher";

interface IParams {
  conversationId: string;
}

export async function POST(
  request: Request,
  context: { params: Promise<IParams> }
) {
  try {
    const currentUser = await getCurrentUser();
    const { conversationId } = await context.params;

    if (!currentUser?.id || !currentUser?.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { users: true },
    });

    if (!conversation) {
      return new NextResponse("Conversation not found", { status: 404 });
    }

    if (!conversation.isGroup) {
      return new NextResponse("Cannot leave 1-1 conversation", { status: 400 });
    }

    // Remove user from conversation
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        users: {
          disconnect: { id: currentUser.id },
        },
      },
      include: { users: true },
    });

    // Create system message for leaving
    const systemMessage = await prisma.message.create({
      data: {
        body: `${currentUser.name} left the group`,
        conversationId: conversationId,
        senderId: currentUser.id,
        isDeleted: false,
      },
      include: {
        sender: true,
        seen: true,
      },
    });

    // Update conversation's lastMessageAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    // Notify all remaining users
    try {
      // Prepare conversation update with system message
      // Note: Keep payload small to avoid Pusher 10KB limit
      // Only include image URL if it's not base64 (base64 images are too large)
      const isBase64 = (str: string | null) => str && str.startsWith('data:');
      
      const conversationUpdate = {
        id: conversationId,
        users: updatedConversation.users.map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          image: isBase64(u.image) ? null : u.image, // Skip base64 images
        })),
        name: updatedConversation.name,
        isGroup: updatedConversation.isGroup,
        image: isBase64(updatedConversation.image) ? null : updatedConversation.image,
        lastMessageAt: new Date(),
        messages: [{
          id: systemMessage.id,
          body: systemMessage.body,
          createdAt: systemMessage.createdAt,
          senderId: systemMessage.senderId,
          isDeleted: false,
          sender: {
            id: systemMessage.sender.id,
            name: systemMessage.sender.name,
            email: systemMessage.sender.email,
            image: isBase64(systemMessage.sender.image) ? null : systemMessage.sender.image,
          },
          seen: [],
          reactions: [],
        }],
      };
      
      // Log payload size
      const payloadSize = JSON.stringify(conversationUpdate).length;
      console.log("Leave group - Payload size:", payloadSize, "bytes");

      const remainingUserEmails = updatedConversation.users
        .filter((user: any) => user.email)
        .map((user: any) => user.email!);
      
      console.log("=== LEAVE GROUP DEBUG ===");
      console.log("Leave group - Sending conversation:update to:", remainingUserEmails);
      console.log("Leave group - Updated users count:", conversationUpdate.users.length);
      console.log("Leave group - Full payload:", JSON.stringify(conversationUpdate, null, 2));
      console.log("=========================");

      await Promise.all([
        // Update conversation for remaining users
        ...remainingUserEmails.map((email: string) => 
          pusherServer.trigger(email, "conversation:update", conversationUpdate)
        ),
        // Send system message to remaining users via conversation channel
        pusherServer.trigger(conversationId, "messages:new", systemMessage),
        // Notify leaving user to remove conversation
        pusherServer.trigger(
          currentUser.email,
          "conversation:remove",
          { id: conversationId }
        ),
      ]);
    } catch (pusherError) {
      console.error("Pusher error:", pusherError);
      // Silent fail
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("ERROR_LEAVE_GROUP:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
