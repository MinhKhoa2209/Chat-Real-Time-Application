import prisma from "@/app/libs/prismadb";
import getCurrentUser from "./getCurrentUser";

const getMessages = async (conversationId: string) => {
  try {
    const currentUser = await getCurrentUser();
    
    const messages = await prisma.message.findMany({
      where: { 
        conversationId,
        // Filter out messages hidden for current user
        ...(currentUser?.id && {
          NOT: {
            hiddenForIds: {
              has: currentUser.id,
            },
          },
        }),
      },
      take: 50, // Limit to last 50 messages for performance
      orderBy: { createdAt: "desc" },
      include: {
        sender: true,
        seen: true,
        reactions: {
          include: {
            user: true,
          },
        },
        replyTo: {
          include: {
            sender: true,
          },
        },
        forwardedFrom: true,
      },
    });

    // Reverse to get chronological order
    return messages.reverse();
  } catch {
    return [];
  }
};

export default getMessages;