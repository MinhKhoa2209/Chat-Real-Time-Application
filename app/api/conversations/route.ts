import getCurrentUser from "@/app/actions/getCurrentUser";
import prisma from "@/app/libs/prismadb";
import { pusherServer } from "@/app/libs/pusher";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const conversations = await prisma.conversation.findMany({
      orderBy: {
        lastMessageAt: "desc",
      },
      where: {
        userIds: {
          has: currentUser.id,
        },
        // Filter out conversations deleted by current user
        // Handle both cases: deletedForIds exists or is empty/null
        OR: [
          { deletedForIds: { isEmpty: true } },
          { NOT: { deletedForIds: { has: currentUser.id } } },
        ],
      },
      include: {
        users: {
          select: { id: true, name: true, email: true, image: true },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            body: true,
            image: true,
            createdAt: true,
            senderId: true,
            seenIds: true,
            sender: { select: { id: true, name: true, email: true, image: true } },
            seen: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(conversations);
  } catch (error: any) {
    console.error("GET_CONVERSATIONS_ERROR:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    const body = await request.json();
    const { userId, isGroup, members, name } = body;

    if (!currentUser?.id || !currentUser?.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Create 1-on-1 conversation
    if (userId && !isGroup) {
      const existingConversations = await prisma.conversation.findMany({
        where: {
          OR: [
            {
              userIds: {
                equals: [currentUser.id, userId],
              },
            },
            {
              userIds: {
                equals: [userId, currentUser.id],
              },
            },
          ],
        },
        select: {
          id: true,
          deletedForIds: true,
          users: true,
        },
      });

      const singleConversation = existingConversations[0];

      if (singleConversation) {
        // Clear deletedForIds for current user if they had deleted this conversation
        if (singleConversation.deletedForIds?.includes(currentUser.id)) {
          const updatedDeletedForIds = singleConversation.deletedForIds.filter(
            (id: string) => id !== currentUser.id
          );
          await prisma.conversation.update({
            where: { id: singleConversation.id },
            data: { deletedForIds: updatedDeletedForIds },
          });
        }
        return NextResponse.json(singleConversation);
      }

      const newConversation = await prisma.conversation.create({
        data: {
          users: {
            connect: [
              {
                id: currentUser.id,
              },
              {
                id: userId,
              },
            ],
          },
        },
        include: {
          users: true,
        },
      });

      newConversation.users.forEach((user) => {
        if (user.email) {
          pusherServer.trigger(user.email, "conversation:new", newConversation);
        }
      });

      return NextResponse.json(newConversation);
    }

    // Create group conversation
    if (isGroup && members && Array.isArray(members) && name) {
      const newConversation = await prisma.conversation.create({
        data: {
          name,
          isGroup,
          users: {
            connect: [
              ...members.map((member: { value: string }) => ({
                id: member.value,
              })),
              {
                id: currentUser.id,
              },
            ],
          },
        },
        include: {
          users: true,
        },
      });

      newConversation.users.forEach((user) => {
        if (user.email) {
          pusherServer.trigger(user.email, "conversation:new", newConversation);
        }
      });

      return NextResponse.json(newConversation);
    }

    return new NextResponse("Invalid data", { status: 400 });
  } catch (error: any) {
    console.error("POST_CONVERSATIONS_ERROR:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

