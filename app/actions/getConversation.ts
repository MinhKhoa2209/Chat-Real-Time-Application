import prisma from "@/app/libs/prismadb";
import getCurrentUser from "./getCurrentUser";

const getConversations = async () => {
  const currentUser = await getCurrentUser();

  if (!currentUser?.id) {
    return [];
  }

  try {
    // Get conversations using user's conversationIds for better performance
    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { conversationIds: true },
    });

    if (!user?.conversationIds?.length) {
      return [];
    }

    const allConversations = await prisma.conversation.findMany({
      where: {
        id: { in: user.conversationIds },
      },
      orderBy: {
        lastMessageAt: "desc",
      },
      select: {
        id: true,
        name: true,
        image: true,
        isGroup: true,
        lastMessageAt: true,
        createdAt: true,
        userIds: true,
        deletedForIds: true, // Include this to filter
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          where: {
            isDeleted: false,
          },
          select: {
            id: true,
            body: true,
            image: true,
            fileUrl: true,
            fileName: true,
            createdAt: true,
            senderId: true,
            seenIds: true,
            isDeleted: true,
            hiddenForIds: true,
            sender: {
              select: { id: true, name: true, email: true, image: true },
            },
            seen: {
              select: { id: true, email: true, name: true },
            },
          },
        },
      },
    });

    // Filter out conversations deleted by current user (do this in JS for reliability)
    const conversations = allConversations
      .filter((conv) => {
        const deletedForIds = conv.deletedForIds || [];
        return !deletedForIds.includes(currentUser.id);
      })
      .slice(0, 20) // Limit to 20
      .map(({ deletedForIds, ...rest }) => rest); // Remove deletedForIds from response

    return conversations;
  } catch {
    return [];
  }
};
export default getConversations;
