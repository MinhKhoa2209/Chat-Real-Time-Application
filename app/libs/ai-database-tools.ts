import prisma from "@/app/libs/prismadb";

/**
 * Database query tools for AI to access MongoDB data
 */
export const AIDatabase = {
  /**
   * Get user information by email or name
   */
  async getUserInfo(query: string) {
    try {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          _count: {
            select: {
              conversations: true,
              messages: true,
            },
          },
        },
        take: 5,
      });

      return users.map(u => ({
        name: u.name,
        email: u.email,
        joinedDate: u.createdAt.toLocaleDateString('vi-VN'),
        totalConversations: u._count.conversations,
        totalMessages: u._count.messages,
      }));
    } catch (error) {
      console.error('[AIDatabase] getUserInfo error:', error);
      return [];
    }
  },

  /**
   * Get conversation statistics
   */
  async getConversationStats(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          conversations: {
            select: {
              id: true,
              name: true,
              isGroup: true,
              createdAt: true,
              _count: {
                select: {
                  messages: true,
                  users: true,
                },
              },
            },
          },
        },
      });

      if (!user) return null;

      const totalConversations = user.conversations.length;
      const groupChats = user.conversations.filter(c => c.isGroup).length;
      const directChats = totalConversations - groupChats;

      return {
        totalConversations,
        groupChats,
        directChats,
        conversations: user.conversations.map(c => ({
          name: c.name || 'Direct Chat',
          type: c.isGroup ? 'Group' : '1-on-1',
          messageCount: c._count.messages,
          memberCount: c._count.users,
          createdDate: c.createdAt.toLocaleDateString('vi-VN'),
        })),
      };
    } catch (error) {
      console.error('[AIDatabase] getConversationStats error:', error);
      return null;
    }
  },

  /**
   * Get message statistics for a user
   */
  async getMessageStats(userId: string) {
    try {
      const totalSent = await prisma.message.count({
        where: { senderId: userId },
      });

      const recentMessages = await prisma.message.findMany({
        where: { senderId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          body: true,
          createdAt: true,
          conversation: {
            select: {
              name: true,
              isGroup: true,
            },
          },
        },
      });

      const messagesWithImages = await prisma.message.count({
        where: {
          senderId: userId,
          image: { not: null },
        },
      });

      const messagesWithFiles = await prisma.message.count({
        where: {
          senderId: userId,
          fileUrl: { not: null },
        },
      });

      return {
        totalSent,
        messagesWithImages,
        messagesWithFiles,
        recentMessages: recentMessages.map(m => ({
          text: m.body?.substring(0, 50) || '[Media]',
          date: m.createdAt.toLocaleDateString('vi-VN'),
          conversation: m.conversation.name || 'Direct Chat',
        })),
      };
    } catch (error) {
      console.error('[AIDatabase] getMessageStats error:', error);
      return null;
    }
  },

  /**
   * Search messages by content
   */
  async searchMessages(userId: string, searchQuery: string) {
    try {
      const messages = await prisma.message.findMany({
        where: {
          conversation: {
            users: {
              some: { id: userId },
            },
          },
          body: {
            contains: searchQuery,
            mode: 'insensitive',
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          body: true,
          createdAt: true,
          sender: {
            select: {
              name: true,
            },
          },
          conversation: {
            select: {
              name: true,
              isGroup: true,
            },
          },
        },
      });

      return messages.map(m => ({
        text: m.body,
        sender: m.sender.name,
        date: m.createdAt.toLocaleDateString('vi-VN'),
        time: m.createdAt.toLocaleTimeString('vi-VN'),
        conversation: m.conversation.name || 'Direct Chat',
      }));
    } catch (error) {
      console.error('[AIDatabase] searchMessages error:', error);
      return [];
    }
  },

  /**
   * Get overall platform statistics
   */
  async getPlatformStats() {
    try {
      const [totalUsers, totalConversations, totalMessages, totalGroups] = await Promise.all([
        prisma.user.count(),
        prisma.conversation.count(),
        prisma.message.count(),
        prisma.conversation.count({ where: { isGroup: true } }),
      ]);

      const recentUsers = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          name: true,
          createdAt: true,
        },
      });

      return {
        totalUsers,
        totalConversations,
        totalMessages,
        totalGroups,
        recentUsers: recentUsers.map(u => ({
          name: u.name,
          joinedDate: u.createdAt.toLocaleDateString('vi-VN'),
        })),
      };
    } catch (error) {
      console.error('[AIDatabase] getPlatformStats error:', error);
      return null;
    }
  },

  /**
   * Get user's contacts (people they've chatted with)
   */
  async getUserContacts(userId: string) {
    try {
      const conversations = await prisma.conversation.findMany({
        where: {
          users: {
            some: { id: userId },
          },
        },
        include: {
          users: {
            where: {
              id: { not: userId },
            },
            select: {
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
      });

      const contacts = new Map();
      conversations.forEach(conv => {
        conv.users.forEach(user => {
          if (!contacts.has(user.email)) {
            contacts.set(user.email, {
              name: user.name,
              email: user.email,
              messageCount: conv._count.messages,
            });
          }
        });
      });

      return Array.from(contacts.values());
    } catch (error) {
      console.error('[AIDatabase] getUserContacts error:', error);
      return [];
    }
  },

  /**
   * Get personalization data - who user chats with most, chat habits
   * Query ALL tables: User, Message, Conversation, Reaction, Call
   */
  async getPersonalizationData(userId: string) {
    try {
      // 1. Get user info
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          _count: {
            select: {
              messages: true,
              conversations: true,
              reactions: true,
            },
          },
        },
      });

      // 2. Get ALL conversations user is part of (both 1-1 and groups)
      const allConversations = await prisma.conversation.findMany({
        where: {
          users: { some: { id: userId } },
        },
        include: {
          users: {
            select: { id: true, name: true, email: true, image: true },
          },
          messages: {
            where: { isDeleted: false },
            select: {
              id: true,
              senderId: true,
              createdAt: true,
              body: true,
              image: true,
              fileUrl: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      // Separate 1-1 and group conversations
      const conversations = allConversations.filter(c => !c.isGroup);
      const groupConversations = allConversations.filter(c => c.isGroup);

      console.log('[AIDatabase] Found conversations:', allConversations.length, '1-1:', conversations.length, 'groups:', groupConversations.length);

      // 4. Calculate messages per contact (1-1 chats)
      const contactStats = new Map<string, {
        name: string;
        email: string;
        image: string | null;
        totalMessages: number;
        sentByUser: number;
        receivedByUser: number;
        lastMessageDate: Date | null;
        lastMessagePreview: string | null;
        conversationId: string;
      }>();

      conversations.forEach(conv => {
        // Filter out current user to get the other person in 1-1 chat
        const otherUser = conv.users.find(u => u.id !== userId);
        if (!otherUser) return;

        const sentByUser = conv.messages.filter(m => m.senderId === userId).length;
        const receivedByUser = conv.messages.filter(m => m.senderId !== userId).length;
        const lastMessage = conv.messages[0];

        contactStats.set(otherUser.id, {
          name: otherUser.name || 'Unknown',
          email: otherUser.email || '',
          image: otherUser.image,
          totalMessages: sentByUser + receivedByUser,
          sentByUser,
          receivedByUser,
          lastMessageDate: lastMessage?.createdAt || null,
          lastMessagePreview: lastMessage?.body?.substring(0, 50) || (lastMessage?.image ? '[Hình ảnh]' : null),
          conversationId: conv.id,
        });
      });

      // Sort by total messages
      const topContacts = Array.from(contactStats.values())
        .sort((a, b) => b.totalMessages - a.totalMessages)
        .slice(0, 10);

      // Sort by last message date to find most recent and least recent
      const contactsByRecency = Array.from(contactStats.values())
        .filter(c => c.lastMessageDate !== null)
        .sort((a, b) => new Date(b.lastMessageDate!).getTime() - new Date(a.lastMessageDate!).getTime());
      
      const mostRecentContact = contactsByRecency[0] || null;
      const leastRecentContact = contactsByRecency.length > 1 ? contactsByRecency[contactsByRecency.length - 1] : null;

      // 5. Get ALL messages for habit analysis
      const allMessages = await prisma.message.findMany({
        where: { senderId: userId, isDeleted: false },
        select: { 
          createdAt: true,
          body: true,
          image: true,
          fileUrl: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      });

      // 6. Analyze chat habits
      const hourlyActivity: Record<number, number> = {};
      const dailyActivity: Record<number, number> = {};
      let messagesWithMedia = 0;
      let messagesWithFiles = 0;
      let totalTextLength = 0;
      
      allMessages.forEach(msg => {
        const hour = msg.createdAt.getHours();
        const day = msg.createdAt.getDay();
        hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
        dailyActivity[day] = (dailyActivity[day] || 0) + 1;
        
        if (msg.image) messagesWithMedia++;
        if (msg.fileUrl) messagesWithFiles++;
        if (msg.body) totalTextLength += msg.body.length;
      });

      const peakHour = Object.entries(hourlyActivity)
        .sort(([, a], [, b]) => b - a)[0];
      const peakDay = Object.entries(dailyActivity)
        .sort(([, a], [, b]) => b - a)[0];

      const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

      // 7. Get reaction stats
      const reactionStats = await prisma.reaction.groupBy({
        by: ['content'],
        where: { userId },
        _count: { content: true },
        orderBy: { _count: { content: 'desc' } },
        take: 5,
      });

      const receivedReactions = await prisma.reaction.count({
        where: {
          message: { senderId: userId },
        },
      });

      // 8. Get call stats
      const callStats = await prisma.call.aggregate({
        where: {
          OR: [
            { callerId: userId },
            { receiverId: userId },
          ],
        },
        _count: true,
        _sum: { duration: true },
      });

      const callsByType = await prisma.call.groupBy({
        by: ['type', 'status'],
        where: {
          OR: [
            { callerId: userId },
            { receiverId: userId },
          ],
        },
        _count: true,
      });

      // 9. Get forwarded messages count
      const forwardedCount = await prisma.message.count({
        where: { forwardedFromId: userId },
      });

      // 10. Calculate average message length
      const avgMessageLength = allMessages.length > 0 
        ? Math.round(totalTextLength / allMessages.filter(m => m.body).length) 
        : 0;

      return {
        userInfo: currentUser,
        topContacts,
        mostChattedWith: topContacts[0] || null,
        mostRecentContact,
        leastRecentContact,
        chatHabits: {
          peakHour: peakHour ? parseInt(peakHour[0]) : null,
          peakDay: peakDay ? dayNames[parseInt(peakDay[0])] : null,
          totalAnalyzedMessages: allMessages.length,
          hourlyActivity,
          dailyActivity,
          messagesWithMedia,
          messagesWithFiles,
          avgMessageLength,
        },
        groupStats: {
          totalGroups: groupConversations.length,
          groups: groupConversations.map(g => ({
            name: g.name || 'Nhóm không tên',
            memberCount: g.users.length,
            messageCount: g.messages.length,
          })),
        },
        reactionStats: {
          given: reactionStats.map(r => ({ emoji: r.content, count: r._count.content })),
          received: receivedReactions,
        },
        callStats: {
          totalCalls: callStats._count,
          totalDuration: callStats._sum.duration || 0,
          byType: callsByType,
        },
        forwardedMessages: forwardedCount,
      };
    } catch (error) {
      console.error('[AIDatabase] getPersonalizationData error:', error);
      return null;
    }
  },

  /**
   * Get unread messages summary for a conversation
   */
  async getUnreadMessagesSummary(userId: string, conversationId: string) {
    try {
      // Get messages not seen by user
      const unreadMessages = await prisma.message.findMany({
        where: {
          conversationId,
          senderId: { not: userId },
          NOT: {
            seenIds: { has: userId },
          },
          isDeleted: false,
        },
        orderBy: { createdAt: 'asc' },
        include: {
          sender: {
            select: { name: true },
          },
        },
      });

      if (unreadMessages.length === 0) {
        return {
          hasUnread: false,
          count: 0,
          messages: [],
          summary: null,
        };
      }

      // Group messages by sender
      const messagesBySender: Record<string, string[]> = {};
      unreadMessages.forEach(msg => {
        const senderName = msg.sender.name || 'Unknown';
        if (!messagesBySender[senderName]) {
          messagesBySender[senderName] = [];
        }
        if (msg.body) {
          messagesBySender[senderName].push(msg.body);
        } else if (msg.image) {
          messagesBySender[senderName].push('[Hình ảnh]');
        } else if (msg.fileUrl) {
          messagesBySender[senderName].push(`[File: ${msg.fileName || 'đính kèm'}]`);
        }
      });

      return {
        hasUnread: true,
        count: unreadMessages.length,
        messages: unreadMessages.map(m => ({
          id: m.id,
          body: m.body,
          sender: m.sender.name,
          createdAt: m.createdAt,
          hasImage: !!m.image,
          hasFile: !!m.fileUrl,
        })),
        messagesBySender,
        firstUnreadAt: unreadMessages[0].createdAt,
        lastUnreadAt: unreadMessages[unreadMessages.length - 1].createdAt,
      };
    } catch (error) {
      console.error('[AIDatabase] getUnreadMessagesSummary error:', error);
      return null;
    }
  },

  /**
   * Get all conversations with unread counts
   */
  async getConversationsWithUnread(userId: string) {
    try {
      const conversations = await prisma.conversation.findMany({
        where: {
          users: { some: { id: userId } },
          NOT: { deletedForIds: { has: userId } },
        },
        include: {
          users: {
            select: { id: true, name: true, image: true },
          },
          messages: {
            where: {
              senderId: { not: userId },
              NOT: { seenIds: { has: userId } },
              isDeleted: false,
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
              sender: { select: { name: true } },
            },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
      });

      return conversations
        .filter(conv => conv.messages.length > 0)
        .map(conv => ({
          id: conv.id,
          name: conv.name || conv.users.filter((u: { id: string; name: string | null }) => u.id !== userId).map((u: { name: string | null }) => u.name).join(', '),
          isGroup: conv.isGroup,
          unreadCount: conv.messages.length,
          lastUnreadMessage: conv.messages[0]?.body || '[Media]',
          lastUnreadSender: conv.messages[0]?.sender.name,
          lastUnreadAt: conv.messages[0]?.createdAt,
        }));
    } catch (error) {
      console.error('[AIDatabase] getConversationsWithUnread error:', error);
      return [];
    }
  },

  /**
   * Get detailed call history for user
   */
  async getCallHistory(userId: string) {
    try {
      const calls = await prisma.call.findMany({
        where: {
          OR: [
            { callerId: userId },
            { receiverId: userId },
          ],
        },
        orderBy: { startedAt: 'desc' },
        take: 20,
      });

      // Get user names for caller/receiver
      const userIds = [...new Set(calls.flatMap(c => [c.callerId, c.receiverId]))];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      });
      const userMap = new Map(users.map(u => [u.id, u.name]));

      return calls.map(call => ({
        id: call.id,
        type: call.type,
        status: call.status,
        isOutgoing: call.callerId === userId,
        otherPerson: userMap.get(call.callerId === userId ? call.receiverId : call.callerId) || 'Unknown',
        startedAt: call.startedAt,
        duration: call.duration,
        endReason: call.endReason,
      }));
    } catch (error) {
      console.error('[AIDatabase] getCallHistory error:', error);
      return [];
    }
  },

  /**
   * Get reaction analytics for user
   */
  async getReactionAnalytics(userId: string) {
    try {
      // Reactions given by user
      const givenReactions = await prisma.reaction.groupBy({
        by: ['content'],
        where: { userId },
        _count: { content: true },
        orderBy: { _count: { content: 'desc' } },
      });

      // Reactions received on user's messages
      const receivedReactions = await prisma.reaction.findMany({
        where: {
          message: { senderId: userId },
        },
        include: {
          user: { select: { name: true } },
          message: { select: { body: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      // Group received by emoji
      const receivedByEmoji: Record<string, number> = {};
      receivedReactions.forEach(r => {
        receivedByEmoji[r.content] = (receivedByEmoji[r.content] || 0) + 1;
      });

      return {
        given: givenReactions.map(r => ({ emoji: r.content, count: r._count.content })),
        received: {
          total: receivedReactions.length,
          byEmoji: Object.entries(receivedByEmoji).map(([emoji, count]) => ({ emoji, count })),
          recent: receivedReactions.slice(0, 5).map(r => ({
            emoji: r.content,
            from: r.user.name,
            onMessage: r.message.body?.substring(0, 30) || '[Media]',
          })),
        },
      };
    } catch (error) {
      console.error('[AIDatabase] getReactionAnalytics error:', error);
      return null;
    }
  },

  /**
   * Get comprehensive user activity summary
   */
  async getActivitySummary(userId: string, days: number = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Messages in period
      const messageCount = await prisma.message.count({
        where: {
          senderId: userId,
          createdAt: { gte: startDate },
          isDeleted: false,
        },
      });

      // Reactions in period
      const reactionCount = await prisma.reaction.count({
        where: {
          userId,
          createdAt: { gte: startDate },
        },
      });

      // Calls in period
      const callCount = await prisma.call.count({
        where: {
          OR: [
            { callerId: userId },
            { receiverId: userId },
          ],
          startedAt: { gte: startDate },
        },
      });

      // Active conversations
      const activeConversations = await prisma.conversation.count({
        where: {
          users: { some: { id: userId } },
          lastMessageAt: { gte: startDate },
        },
      });

      // Messages by day
      const messagesByDay = await prisma.message.groupBy({
        by: ['createdAt'],
        where: {
          senderId: userId,
          createdAt: { gte: startDate },
          isDeleted: false,
        },
        _count: true,
      });

      return {
        period: `${days} ngày gần đây`,
        messages: messageCount,
        reactions: reactionCount,
        calls: callCount,
        activeConversations,
        avgMessagesPerDay: Math.round(messageCount / days),
      };
    } catch (error) {
      console.error('[AIDatabase] getActivitySummary error:', error);
      return null;
    }
  },
};
