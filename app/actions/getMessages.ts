import prisma from "@/app/libs/prismadb";

const getMessages = async (conversationId: string) => {
  try {
    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversationId
      },
      include: {
        sender: true,
        seen: true,
        reactions: {
            include: {
                user: true 
            }
        },
        replyTo: {
            include: {
                sender: true,
                seen: true,
                reactions: {
                    include: {
                        user: true
                    }
                }
            }
        },
        forwardedFrom: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return messages;
  } catch (error: any) {
    return [];
  }
};

export default getMessages;