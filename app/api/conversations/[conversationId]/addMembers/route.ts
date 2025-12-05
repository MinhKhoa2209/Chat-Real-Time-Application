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
    const body = await request.json();
    const { memberIds } = body;

    if (!currentUser?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return new NextResponse("Invalid member IDs", { status: 400 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { users: true },
    });

    if (!conversation) {
      return new NextResponse("Conversation not found", { status: 404 });
    }

    if (!conversation.isGroup) {
      return new NextResponse("Cannot add members to 1-1 conversation", { status: 400 });
    }

    // Add new members
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        users: {
          connect: memberIds.map(id => ({ id })),
        },
      },
      include: { users: true },
    });

    // Get new members' info for system message
    const newMembers = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true, email: true },
    });
    const newMemberNames = newMembers.map((m: any) => m.name).join(", ");
    const newMemberEmails = newMembers.map((m: any) => m.email);

    // Create system message for adding members
    const systemMessage = await prisma.message.create({
      data: {
        body: `${currentUser.name} added ${newMemberNames} to the group`,
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

    // Notify all users (including new members)
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
          addedMemberEmails: newMemberEmails, 
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
      
      const payloadSize = JSON.stringify(conversationUpdate).length;
      console.log("Add members - Payload size:", payloadSize, "bytes");

      // Separate existing users and new members
      const existingUserEmails = updatedConversation.users
        .filter((user: any) => user.email && !memberIds.includes(user.id))
        .map((user: any) => user.email!);

      const newMemberEmailsForPusher = updatedConversation.users
        .filter((user: any) => user.email && memberIds.includes(user.id))
        .map((user: any) => user.email!);

      console.log("Sending conversation:update to existing users:", existingUserEmails);
      console.log("Sending conversation:new to new members:", newMemberEmailsForPusher);
      console.log("Conversation update payload:", JSON.stringify(conversationUpdate, null, 2));

      await Promise.all([
        // Update conversation for existing users (including the one who added)
        ...existingUserEmails.map((email: string) => 
          pusherServer.trigger(email, "conversation:update", conversationUpdate)
        ),
        // Send system message to all users via conversation channel
        pusherServer.trigger(conversationId, "messages:new", systemMessage),
      ]);

      // Notify new members with full conversation (conversation:new)
      for (const email of newMemberEmailsForPusher) {
        // Fetch full conversation for new members
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
          // Add addedMemberEmails to the last message for personalized display
          // Keep payload small - skip base64 images
          const conversationWithAddedInfo = {
            id: fullConversation.id,
            name: fullConversation.name,
            isGroup: fullConversation.isGroup,
            image: isBase64(fullConversation.image) ? null : fullConversation.image,
            lastMessageAt: fullConversation.lastMessageAt,
            users: fullConversation.users.map((u: any) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              image: isBase64(u.image) ? null : u.image,
            })),
            messages: fullConversation.messages.map((msg: any) => ({
              id: msg.id,
              body: msg.body,
              createdAt: msg.createdAt,
              senderId: msg.senderId,
              isDeleted: msg.isDeleted,
              addedMemberEmails: newMemberEmails,
              sender: msg.sender ? {
                id: msg.sender.id,
                name: msg.sender.name,
                email: msg.sender.email,
                image: isBase64(msg.sender.image) ? null : msg.sender.image,
              } : null,
              seen: [],
              reactions: [],
            })),
          };
          
          const newPayloadSize = JSON.stringify(conversationWithAddedInfo).length;
          console.log("Sending conversation:new to:", email, "payload size:", newPayloadSize, "bytes");
          
          await pusherServer.trigger(
            email,
            "conversation:new",
            conversationWithAddedInfo
          );
        }
      }
    } catch (pusherError) {
      console.error("Pusher error:", pusherError);
      // Silent fail
    }

    return NextResponse.json(updatedConversation);
  } catch (error) {
    console.error("ERROR_ADD_MEMBERS:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
