import prisma from "@/app/libs/prismadb";
import getCurrentUser from "@/app/actions/getCurrentUser";
import { NextResponse } from "next/server";
import { pusherServer } from "@/app/libs/pusher";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    const body = await request.json();
    const { name, image } = body;

    if (!currentUser?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const updatedUser = await prisma.user.update({
      where: {
        id: currentUser.id,
      },
      data: {
        image: image,
        name: name,
      },
    });

    // Get all conversations this user is part of
    const conversations = await prisma.conversation.findMany({
      where: {
        userIds: {
          has: currentUser.id,
        },
      },
      select: {
        id: true,
        userIds: true,
      },
    });

    // Notify all users in those conversations about the profile update
    const notifiedUsers = new Set<string>();
    
    for (const conversation of conversations) {
      for (const userId of conversation.userIds) {
        if (userId !== currentUser.id && !notifiedUsers.has(userId)) {
          notifiedUsers.add(userId);
          
          // Get user email to use as channel
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true },
          });
          
          if (user?.email) {
            await pusherServer.trigger(user.email, "user:update", {
              id: updatedUser.id,
              name: updatedUser.name,
              image: updatedUser.image,
              email: updatedUser.email,
            });
          }
        }
      }
    }

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    console.log(error, "ERROR_SETTINGS");
    return new NextResponse("Internal Error", { status: 500 });
  }
}
