import getCurrentUser from "@/app/actions/getCurrentUser";
import { NextResponse } from "next/server";
import prisma from "@/app/libs/prismadb";
import { pusherServer } from "@/app/libs/pusher";
interface IParams {
  conversationId?: string;
}

export async function GET(
  request: Request,
  context: { params: Promise<IParams> }
) {
  try {
    const { conversationId } = await context.params;
    const currentUser = await getCurrentUser();

    if (!currentUser?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!conversationId) {
      return new NextResponse("Invalid conversation ID", { status: 400 });
    }

    const conversation = await prisma.conversation.findUnique({
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

    if (!conversation) {
      return new NextResponse("Conversation not found", { status: 404 });
    }

    // Check if user is part of the conversation
    const isUserInConversation = conversation.users.some(
      (user: any) => user.id === currentUser.id
    );

    if (!isUserInConversation) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("ERROR_GET_CONVERSATION:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<IParams> }
) {
  try {
    const { conversationId } = await context.params;
    const currentUser = await getCurrentUser();
    const body = await request.json();
    const { name, image } = body;

    if (!currentUser?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!conversationId) {
      return new NextResponse("Invalid conversation ID", { status: 400 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { users: true },
    });

    if (!conversation) {
      return new NextResponse("Conversation not found", { status: 404 });
    }

    if (!conversation.isGroup) {
      return new NextResponse("Cannot update non-group conversation", { status: 400 });
    }

    // Check if user is part of the conversation
    const isUserInConversation = conversation.users.some(
      (user: any) => user.id === currentUser.id
    );

    if (!isUserInConversation) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Update conversation
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        ...(name && { name }),
        ...(image && { image }),
      },
      include: { users: true },
    });

    // Notify all users about the update
    try {
      // Keep payload small - skip base64 images for users
      const isBase64 = (str: string | null) => str && str.startsWith('data:');
      
      const conversationUpdate = {
        id: updatedConversation.id,
        name: updatedConversation.name,
        // For group image, we need to send it even if base64 (it's the main update)
        // But keep it small by not including user images
        image: updatedConversation.image,
        isGroup: updatedConversation.isGroup,
        lastMessageAt: updatedConversation.lastMessageAt,
        users: updatedConversation.users.map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          image: isBase64(u.image) ? null : u.image, // Skip base64 user images
        })),
      };

      const userEmails = updatedConversation.users
        .filter((user: any) => user.email)
        .map((user: any) => user.email!);
      
      const payloadSize = JSON.stringify(conversationUpdate).length;
      console.log("PUT conversation - Payload size:", payloadSize, "bytes");
      console.log("PUT conversation - Sending update to:", userEmails);

      // If payload is too large (>10KB), send without group image
      if (payloadSize > 10000) {
        console.log("Payload too large, sending without group image");
        const smallPayload = {
          ...conversationUpdate,
          image: null,
          imageUpdated: true, // Flag to tell client to refetch
        };
        await Promise.all(
          userEmails.map((email: string) =>
            pusherServer.trigger(email, "conversation:update", smallPayload)
          )
        );
      } else {
        await Promise.all(
          userEmails.map((email: string) =>
            pusherServer.trigger(email, "conversation:update", conversationUpdate)
          )
        );
      }
    } catch (pusherError) {
      console.error("Pusher error:", pusherError);
    }

    return NextResponse.json(updatedConversation);
  } catch (error) {
    console.error("ERROR_CONVERSATION_UPDATE:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<IParams> }
) {
  try {
    const { conversationId } = await context.params;
    const currentUser = await getCurrentUser();
    
    if (!currentUser?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!conversationId) {
      return new NextResponse("Invalid conversation ID", { status: 400 });
    }

    // Find conversation with retry logic for connection issues
    let existingConversation;
    let retries = 3;
    
    while (retries > 0) {
      try {
        existingConversation = await prisma.conversation.findUnique({
          where: {
            id: conversationId,
          },
          include: {
            users: true,
            messages: true,
          },
        });
        break; // Success, exit retry loop
      } catch (dbError: any) {
        retries--;
        if (retries === 0) throw dbError;
        // Wait 1 second before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!existingConversation) {
      return new NextResponse("Conversation not found", { status: 404 });
    }

    // Check if user is part of the conversation
    const isUserInConversation = existingConversation.users.some(
      (user: any) => user.id === currentUser.id
    );

    if (!isUserInConversation) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Soft delete: Add current user to deletedForIds using raw MongoDB
    await prisma.$runCommandRaw({
      update: "Conversation",
      updates: [
        {
          q: { _id: { $oid: conversationId } },
          u: { $addToSet: { deletedForIds: currentUser.id } },
        },
      ],
    });

    const updatedConversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    // Notify only current user about conversation removal
    if (currentUser.email) {
      try {
        await pusherServer.trigger(
          currentUser.email,
          "conversation:remove",
          { id: conversationId }
        );
      } catch (pusherError) {
        // Silent fail
      }
    }
    
    return NextResponse.json({ success: true, conversation: updatedConversation });
  } catch (error: any) {
    console.error("ERROR_CONVERSATION_DELETE:", error);
    
    // Provide more specific error messages
    if (error.code === 'P2010') {
      return new NextResponse("Database connection error. Please try again.", { status: 503 });
    }
    
    if (error.code === 'P2025') {
      return new NextResponse("Conversation not found or already deleted", { status: 404 });
    }
    
    return new NextResponse("Failed to delete conversation. Please try again.", { status: 500 });
  }
}
