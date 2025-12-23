import { GoogleGenAI } from "@google/genai";
import prisma from "@/app/libs/prismadb";
import { AIDatabase } from "@/app/libs/ai-database-tools";

const MODEL_NAME = "gemini-2.5-flash";

export const AIService = {
  async buildSystemPrompt(userId: string) {
    const now = new Date();
    const dateString = now.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    const timeString = now.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

    // Get user's database context
    let dbContext = "";
    try {
      const [conversationStats, messageStats, contacts] = await Promise.all([
        AIDatabase.getConversationStats(userId),
        AIDatabase.getMessageStats(userId),
        AIDatabase.getUserContacts(userId),
      ]);

      if (conversationStats) {
        dbContext += `\n--- YOUR CHAT STATISTICS ---
Total Conversations: ${conversationStats.totalConversations}
- Group Chats: ${conversationStats.groupChats}
- Direct Chats: ${conversationStats.directChats}
`;
      }

      if (messageStats) {
        dbContext += `\nTotal Messages Sent: ${messageStats.totalSent}
- With Images: ${messageStats.messagesWithImages}
- With Files: ${messageStats.messagesWithFiles}
`;
      }

      if (contacts && contacts.length > 0) {
        dbContext += `\nYour Contacts: ${contacts.map(c => c.name).join(", ")}
`;
      }
    } catch (error) {
      console.error("Error building DB context:", error);
    }

    return `
    You are an intelligent AI assistant in KAICHAT Messenger with capabilities:
    - Search for latest information via Google Search
    - Query user data from database
    - Analyze and provide statistics about chat activities
    
    --- TIME CONTEXT ---
    Current time: ${timeString}, date ${dateString} (Vietnam timezone).
    ${dbContext}

    --- DATABASE QUERY CAPABILITIES ---
    You can answer questions about:
    1. Conversation statistics (count, type, members)
    2. Message statistics (total, with images/files)
    3. Contact list
    4. Search messages by content
    5. User information in the system
    6. Platform overview statistics
    7. **PERSONALIZATION**: Who user chats with most, chat habits, peak activity times
    8. **CONVERSATION SUMMARY**: Summarize unread messages in any conversation
    9. **IMAGE GENERATION**: Create images from any prompt

    When users ask about personal data or statistics, use information from DATABASE CONTEXT above.

    --- SPECIAL COMMANDS ---
    - "tạo ảnh [prompt]" or "generate image [prompt]" - Create AI-generated images
    - "ai trò chuyện nhiều nhất" or "chat nhiều nhất với ai" - Show top chat contacts
    - "thói quen chat" or "chat habits" - Analyze user's chatting patterns
    - "tóm tắt tin nhắn chưa đọc" or "summarize unread" - Summarize unread messages
    - "tóm tắt cuộc trò chuyện [name]" - Summarize specific conversation

    --- OPERATING PRINCIPLES ---
    1. **Prioritize Database Context** for personal statistics and chat data
    2. **Use Google Search** for external information (news, weather, etc.)
    3. **Personalize** responses based on user's MEMORY and chat history
    4. **Answer concisely** in natural Vietnamese
    5. **Be helpful** - suggest insights from their data when relevant
    `;
  },

  // Helper function to normalize Vietnamese text (remove diacritics)
  normalizeVietnamese(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  },

  async generateResponse(userId: string, userMessage: string) {
    if (!process.env.GOOGLE_API_KEY) {
      console.error('[AIService] Missing GOOGLE_API_KEY');
      throw new Error("Missing Google API Key");
    }

    console.log('[AIService] Generating response for:', userMessage.substring(0, 50));

    // Check if this is an image generation request
    const isImageRequest = this.detectImageRequest(userMessage);
    
    if (isImageRequest) {
      return await this.generateImage(userMessage);
    }

    // Check if this is a database query request
    const dbQueryResult = await this.handleDatabaseQuery(userId, userMessage);
    if (dbQueryResult) {
      console.log('[AIService] Database query handled');
      return dbQueryResult;
    }

    const systemInstruction = await this.buildSystemPrompt(userId);

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

    const chat = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: systemInstruction,
        tools: [{ googleSearch: {} }],
        temperature: 0.7,
        topP: 0.95,
      },
      history: [
        { role: "model", parts: [{ text: "Hello! I'm ready to help." }] },
      ],
    });

    try {
      console.log('[AIService] Sending message to Gemini...');
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Gemini API timeout after 30s')), 30000)
      );
      
      const result = await Promise.race([
        chat.sendMessage({ message: userMessage }),
        timeoutPromise
      ]) as any;
      
      const fullText = result.text || "";
      console.log('[AIService] Response received:', fullText.substring(0, 100));
      
      if (!fullText || fullText.trim() === "") {
        console.warn('[AIService] Empty response from Gemini');
        return ["I received your message but couldn't generate a response. Please try again!"];
      }
      
      const messages = this.splitIntoMessages(fullText);
      console.log('[AIService] Split into', messages.length, 'messages');
      return messages;
    } catch (error: any) {
      console.error("[AIService] Gemini Error:", error);
      console.error("[AIService] Error details:", error.message, error.code);
      
      if (error.message?.includes('timeout')) {
        return ["The request took too long. Please try a simpler question!"];
      }
      if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
        return ["I'm receiving too many requests right now. Please wait a moment and try again!"];
      }
      if (error.message?.includes('API key')) {
        return ["There's an issue with my configuration. Please contact support!"];
      }
      
      return ["Sorry, I'm experiencing some issues right now. Please try again later!"];
    }
  },

  // Helper function to format personalization response into multiple messages
  formatPersonalizationResponse(p: any): string[] {
    const messages: string[] = [];
    
    // Message 1: Header + User info
    let msg1 = '🎯 PHAN TICH CA NHAN HOA';
    if (p.userInfo) {
      msg1 += '\n\n👤 Tai khoan: ' + p.userInfo.name;
      msg1 += '\n📨 ' + p.userInfo._count.messages + ' tin nhan';
      msg1 += '\n💬 ' + p.userInfo._count.conversations + ' cuoc tro chuyen';
      msg1 += '\n😀 ' + p.userInfo._count.reactions + ' reactions';
    }
    messages.push(msg1);

    // Message 2: Most chatted with + Recent/Inactive contacts
    let msg2 = '';
    if (p.mostChattedWith) {
      msg2 = '🏆 NGUOI BAN CHAT NHIEU NHAT\n\n';
      msg2 += p.mostChattedWith.name + '\n';
      msg2 += '📊 ' + p.mostChattedWith.totalMessages + ' tin nhan\n';
      msg2 += '↗️ Gui: ' + p.mostChattedWith.sentByUser + ' | ↙️ Nhan: ' + p.mostChattedWith.receivedByUser;
    }
    
    // Add most recent contact
    if (p.mostRecentContact) {
      msg2 += '\n\n🕐 GAN DAY NHAT: ' + p.mostRecentContact.name;
      if (p.mostRecentContact.lastMessageDate) {
        msg2 += '\n� T' + new Date(p.mostRecentContact.lastMessageDate).toLocaleDateString('vi-VN');
      }
    }
    
    // Add least recent contact (longest inactive)
    if (p.leastRecentContact) {
      msg2 += '\n\n💤 LAU NHAT CHUA NHAN TIN: ' + p.leastRecentContact.name;
      if (p.leastRecentContact.lastMessageDate) {
        const daysSince = Math.floor((Date.now() - new Date(p.leastRecentContact.lastMessageDate).getTime()) / (1000 * 60 * 60 * 24));
        msg2 += '\n📅 ' + daysSince + ' ngay truoc';
      }
    }
    
    if (msg2) messages.push(msg2.trim());

    // Message 3: Top contacts
    if (p.topContacts && p.topContacts.length > 1) {
      let msg3 = '�n TOP LIEN HE\n\n';
      p.topContacts.slice(0, 5).forEach((contact: any, i: number) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
        msg3 += medal + ' ' + contact.name + ' (' + contact.totalMessages + ')\n';
      });
      messages.push(msg3.trim());
    }

    // Message 4: Chat habits
    if (p.chatHabits) {
      let msg4 = '⏰ THOI QUEN CHAT\n\n';
      if (p.chatHabits.peakHour !== null) {
        msg4 += '🕐 Gio cao diem: ' + p.chatHabits.peakHour + ':00\n';
      }
      if (p.chatHabits.peakDay) {
        msg4 += '📅 Ngay hay chat: ' + p.chatHabits.peakDay + '\n';
      }
      msg4 += '�️ AnhA: ' + p.chatHabits.messagesWithMedia + ' | 📎 File: ' + p.chatHabits.messagesWithFiles + '\n';
      if (p.chatHabits.avgMessageLength > 0) {
        msg4 += '📝 TB ' + p.chatHabits.avgMessageLength + ' ky tu/tin';
      }
      messages.push(msg4.trim());
    }

    // Message 5: Groups + Reactions + Calls
    let msg5 = '';
    if (p.groupStats && p.groupStats.totalGroups > 0) {
      msg5 = '👨‍👩‍👧‍👦 NHOM CHAT (' + p.groupStats.totalGroups + ')\n';
      p.groupStats.groups.slice(0, 3).forEach((g: any) => {
        msg5 += '• ' + g.name + ': ' + g.memberCount + ' nguoi, ' + g.messageCount + ' tin\n';
      });
    }

    if (p.reactionStats) {
      msg5 += '\n😀 REACTIONS\n';
      msg5 += 'Nhan: ' + p.reactionStats.received;
      if (p.reactionStats.given.length > 0) {
        msg5 += ' | Hay dung: ' + p.reactionStats.given.slice(0, 4).map((r: any) => r.emoji + r.count).join(' ');
      }
    }

    if (p.callStats && p.callStats.totalCalls > 0) {
      const totalMinutes = Math.round((p.callStats.totalDuration || 0) / 60);
      msg5 += '\n\n📞 CUOC GOI\n';
      msg5 += p.callStats.totalCalls + ' cuoc | ' + totalMinutes + ' phut';
    }

    if (p.forwardedMessages > 0) {
      msg5 += '\n\n↪️ Chuyen tiep: ' + p.forwardedMessages + ' tin';
    }
    
    if (msg5) messages.push(msg5.trim());

    return messages;
  },

  async handleDatabaseQuery(userId: string, message: string): Promise<string[] | null> {
    const lowerMessage = message.toLowerCase();
    const normalizedMessage = this.normalizeVietnamese(message);

    // Handle "who do I chat with most" - simple answer
    const mostChattedKeywords = [
      'chat nhieu nhat', 'nhan tin nhieu nhat', 'ai nhieu nhat', 
      'most chatted', 'nguoi toi chat', 'nguoi ban chat'
    ];
    
    if (mostChattedKeywords.some(kw => normalizedMessage.includes(kw))) {
      const personalization = await AIDatabase.getPersonalizationData(userId);
      if (personalization?.mostChattedWith) {
        const p = personalization.mostChattedWith;
        return [`🏆 Người bạn chat nhiều nhất: ${p.name} với ${p.totalMessages} tin nhắn (Gửi: ${p.sentByUser} | Nhận: ${p.receivedByUser})`];
      }
      return ['Chưa có đủ dữ liệu để phân tích. Hãy chat thêm nhé!'];
    }

    // Handle full personalization/habits analysis - detailed response
    const fullAnalysisKeywords = [
      'ca nhan hoa', 'personalization', 'thoi quen chat', 'thoi quen nhan tin',
      'chat habits', 'phan tich', 'than thiet'
    ];
    
    if (fullAnalysisKeywords.some(kw => normalizedMessage.includes(kw))) {
      const personalization = await AIDatabase.getPersonalizationData(userId);
      if (personalization) {
        return this.formatPersonalizationResponse(personalization);
      }
      return ['Chưa có đủ dữ liệu để phân tích. Hãy chat thêm nhé!'];
    }

    // Handle conversation summary queries
    const summaryKeywords = [
      'tom tat', 'summarize', 'chua doc', 'unread', 
      'noi dung chinh', 'summary', 'tin nhan moi'
    ];
    
    if (summaryKeywords.some(kw => normalizedMessage.includes(kw))) {
      const conversationsWithUnread = await AIDatabase.getConversationsWithUnread(userId);
      
      if (conversationsWithUnread.length === 0) {
        return [`✅ Bạn đã đọc hết tin nhắn! Không có tin nhắn chưa đọc nào.`];
      }

      let response = `📬 Tóm tắt tin nhắn chưa đọc:\n\n`;
      
      for (const conv of conversationsWithUnread.slice(0, 5)) {
        response += `📍 ${conv.name}${conv.isGroup ? ' (Nhóm)' : ''}\n`;
        response += `   • ${conv.unreadCount} tin nhắn chưa đọc\n`;
        response += `   • Tin mới nhất từ ${conv.lastUnreadSender}: "${conv.lastUnreadMessage?.substring(0, 50)}${(conv.lastUnreadMessage?.length || 0) > 50 ? '...' : ''}"\n\n`;
      }

      if (conversationsWithUnread.length > 5) {
        response += `... và ${conversationsWithUnread.length - 5} cuộc trò chuyện khác có tin nhắn chưa đọc.`;
      }

      const totalUnread = conversationsWithUnread.reduce((sum, c) => sum + c.unreadCount, 0);
      if (totalUnread > 10) {
        response += `\n\n💡 Tổng cộng ${totalUnread} tin nhắn chưa đọc. Bạn nên kiểm tra các cuộc trò chuyện quan trọng!`;
      }

      return [response];
    }

    // Handle statistics queries
    const statsKeywords = ['thong ke', 'so luong', 'bao nhieu', 'statistics', 'stats'];
    const messageKeywords = ['tin nhan', 'message', 'nhan tin'];
    const conversationKeywords = ['cuoc tro chuyen', 'conversation', 'nhom', 'group', 'chat'];
    
    if (statsKeywords.some(kw => normalizedMessage.includes(kw))) {
      if (messageKeywords.some(kw => normalizedMessage.includes(kw))) {
        const stats = await AIDatabase.getMessageStats(userId);
        if (stats) {
          const response = `📊 Thống kê tin nhắn:\n\n` +
            `• Tổng tin nhắn đã gửi: ${stats.totalSent}\n` +
            `• Tin nhắn có hình ảnh: ${stats.messagesWithImages}\n` +
            `• Tin nhắn có file: ${stats.messagesWithFiles}\n\n` +
            `Bạn đang rất tích cực trong việc giao tiếp! 💬`;
          return [response];
        }
      }

      if (conversationKeywords.some(kw => normalizedMessage.includes(kw))) {
        const stats = await AIDatabase.getConversationStats(userId);
        if (stats) {
          const response = `📊 Thống kê cuộc trò chuyện:\n\n` +
            `• Tổng số cuộc trò chuyện: ${stats.totalConversations}\n` +
            `• Nhóm chat: ${stats.groupChats}\n` +
            `• Chat 1-1: ${stats.directChats}\n\n` +
            `Bạn có một mạng lưới giao tiếp đa dạng! 🌐`;
          return [response];
        }
      }
    }

    // Handle contact list queries
    const contactKeywords = ['danh sach', 'nguoi lien he', 'contact', 'ban be', 'lien lac'];
    if (contactKeywords.some(kw => normalizedMessage.includes(kw))) {
      const contacts = await AIDatabase.getUserContacts(userId);
      if (contacts.length > 0) {
        const contactList = contacts.slice(0, 10).map((c, i) => 
          `${i + 1}. ${c.name} (${c.email})`
        ).join('\n');
        
        const response = `👥 Danh sách người liên hệ:\n\n${contactList}\n\nTổng cộng: ${contacts.length} người liên hệ`;
        return [response];
      }
    }

    // Handle search queries
    const searchMatch = lowerMessage.match(/tim.*?["'](.+?)["']|search.*?["'](.+?)["']|tim\s+kiem\s+(.+)/i);
    if (searchMatch) {
      const searchQuery = searchMatch[1] || searchMatch[2] || searchMatch[3];
      const results = await AIDatabase.searchMessages(userId, searchQuery.trim());
      
      if (results.length > 0) {
        const resultList = results.slice(0, 5).map((r, i) =>
          `${i + 1}. ${r.sender} (${r.date} ${r.time})\n   "${r.text?.substring(0, 100)}..."\n   📍 ${r.conversation}`
        ).join('\n\n');
        
        const response = `🔍 Kết quả tìm kiếm "${searchQuery}":\n\n${resultList}\n\nTìm thấy ${results.length} tin nhắn`;
        return [response];
      } else {
        return [`Không tìm thấy tin nhắn nào chứa "${searchQuery}"`];
      }
    }

    // Handle platform overview queries
    const overviewKeywords = ['tong quan', 'platform', 'he thong', 'overview'];
    if (overviewKeywords.some(kw => normalizedMessage.includes(kw))) {
      const stats = await AIDatabase.getPlatformStats();
      if (stats) {
        const response = `🌐 Thống kê tổng quan hệ thống:\n\n` +
          `• Tổng số người dùng: ${stats.totalUsers}\n` +
          `• Tổng số cuộc trò chuyện: ${stats.totalConversations}\n` +
          `• Tổng số tin nhắn: ${stats.totalMessages}\n` +
          `• Số nhóm chat: ${stats.totalGroups}\n\n` +
          `KAICHAT đang phát triển mạnh mẽ! 🚀`;
        return [response];
      }
    }

    return null;
  },

  detectImageRequest(message: string): boolean {
    const normalizedMsg = this.normalizeVietnamese(message);
    
    // Check normalized (no diacritics) patterns
    const normalizedPatterns = [
      /tao\s*(anh|hinh|tranh|image|buc)/,
      /ve\s*(cho|giup|toi|minh|anh|hinh|mot|1)/,
      /thiet\s*ke\s*(anh|hinh|logo|banner)/,
      /sinh\s*(anh|hinh)/,
      /^(anh|hinh)\s+/,
    ];
    
    // Check original message patterns (English)
    const englishPatterns = [
      /generate\s+(image|picture|photo|art)/i,
      /draw\s+(me|a|an|the)/i,
      /create\s+(image|picture|illustration|art)/i,
      /make\s+(image|picture|photo|art)/i,
      /illustration\s+of/i,
      /picture\s+of/i,
    ];
    
    return normalizedPatterns.some(pattern => pattern.test(normalizedMsg)) ||
           englishPatterns.some(pattern => pattern.test(message));
  },

  extractImagePrompt(message: string): string {
    // Remove Vietnamese command words (with and without diacritics) to get the actual prompt
    const cleanPrompt = message
      .replace(/^(tạo|tao|vẽ|ve|thiết kế|thiet ke|sinh|generate|create|draw|make)\s*/i, '')
      .replace(/^(ảnh|anh|hình|hinh|tranh|image|picture|photo|art|illustration|logo|banner)\s*/i, '')
      .replace(/^(cho|giúp|giup|tôi|toi|mình|minh|của|cua|of|a|an|the|một|mot|1)\s*/i, '')
      .trim();
    
    return cleanPrompt || message;
  },

  async generateImage(userMessage: string): Promise<string[]> {
    try {
      // Extract the actual prompt from user message
      const userPrompt = this.extractImagePrompt(userMessage);
      console.log('[AIService] Image prompt:', userPrompt);

      // Enhance prompt with Gemini first
      const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });
      
      let enhancedPrompt = userPrompt;
      try {
        const promptChat = ai.chats.create({
          model: MODEL_NAME,
          config: {
            systemInstruction: `You are an expert at creating prompts for AI image generation.
            Convert user requests into detailed English prompts. Include style, lighting, composition.
            Only return the prompt, no explanation. Keep under 50 words.
            Make it vivid and descriptive for best image quality.`,
          },
        });

        const promptResult = await promptChat.sendMessage({ 
          message: `Create image prompt for: "${userPrompt}"` 
        });
        
        enhancedPrompt = promptResult.text || userPrompt;
        // Keep prompt short to avoid URL issues
        if (enhancedPrompt.length > 200) {
          enhancedPrompt = enhancedPrompt.substring(0, 200);
        }
        console.log('[AIService] Enhanced prompt:', enhancedPrompt);
      } catch (err) {
        console.log('[AIService] Using original prompt');
      }

      // Encode prompt for URL - use simpler encoding
      const cleanPrompt = enhancedPrompt
        .replace(/[^\w\s,.-]/g, '') // Remove special chars
        .replace(/\s+/g, '%20'); // Replace spaces
      
      // Add random seed for variety and cache busting
      const seed = Math.floor(Math.random() * 1000000);
      
      // Generate image URL using Pollinations.ai with optimized params
      const imageUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=512&height=512&seed=${seed}&nologo=true`;
      
      console.log('[AIService] Pollinations URL:', imageUrl);

      return [
        `IMAGE_URL:${imageUrl}`,
      ];
    } catch (error) {
      console.error("[AIService] Image generation error:", error);
      return [
        "❌ Không thể tạo ảnh lúc này. Vui lòng thử lại với mô tả đơn giản hơn!",
      ];
    }
  },

  splitIntoMessages(text: string): string[] {
    if (!text || text.trim().length === 0) {
      return [""];
    }

    const cleanText = text.trim();
    const paragraphs = cleanText.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    const messages: string[] = [];
    const MAX_LENGTH = 500;

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      
      if (trimmedParagraph.length <= MAX_LENGTH) {
        messages.push(trimmedParagraph);
        continue;
      }

      const sentences = trimmedParagraph.split(/([.!?]\s+)/).filter(s => s.trim().length > 0);
      let currentMessage = "";

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        
        if ((currentMessage + sentence).length <= MAX_LENGTH) {
          currentMessage += sentence;
        } else {
          if (currentMessage.trim().length > 0) {
            messages.push(currentMessage.trim());
          }
          currentMessage = sentence;
        }
      }

      if (currentMessage.trim().length > 0) {
        messages.push(currentMessage.trim());
      }
    }

    return messages.length > 0 ? messages : [cleanText];
  },

  /**
   * Generate AI-powered summary of unread messages in a conversation
   */
  async summarizeConversation(userId: string, conversationId: string): Promise<string[]> {
    try {
      const unreadData = await AIDatabase.getUnreadMessagesSummary(userId, conversationId);
      
      if (!unreadData || !unreadData.hasUnread) {
        return [`✅ Không có tin nhắn chưa đọc trong cuộc trò chuyện này.`];
      }

      // If few messages, just list them
      if (unreadData.count <= 3) {
        let response = `📬 ${unreadData.count} tin nhắn chưa đọc:\n\n`;
        unreadData.messages.forEach((msg, i) => {
          response += `${i + 1}. ${msg.sender}: "${msg.body || '[Media]'}"\n`;
        });
        return [response];
      }

      // For many messages, use AI to summarize
      const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });
      
      const messagesText = Object.entries(unreadData.messagesBySender!)
        .map(([sender, msgs]) => `${sender}:\n${msgs.join('\n')}`)
        .join('\n\n');

      const summaryChat = ai.chats.create({
        model: MODEL_NAME,
        config: {
          systemInstruction: `Bạn là trợ lý tóm tắt tin nhắn. 
          Nhiệm vụ: Tóm tắt ngắn gọn nội dung chính của các tin nhắn.
          - Nêu các điểm quan trọng
          - Ghi chú nếu có câu hỏi cần trả lời
          - Ghi chú nếu có yêu cầu hành động
          - Giữ tóm tắt dưới 150 từ
          - Trả lời bằng tiếng Việt`,
        },
      });

      const summaryResult = await summaryChat.sendMessage({
        message: `Tóm tắt ${unreadData.count} tin nhắn sau:\n\n${messagesText}`,
      });

      const summary = summaryResult.text || 'Không thể tạo tóm tắt.';

      return [
        `📬 Tóm tắt ${unreadData.count} tin nhắn chưa đọc:\n`,
        summary,
        `\n⏰ Từ ${unreadData.firstUnreadAt?.toLocaleString('vi-VN')} đến ${unreadData.lastUnreadAt?.toLocaleString('vi-VN')}`,
      ];
    } catch (error) {
      console.error('[AIService] summarizeConversation error:', error);
      return [`❌ Không thể tóm tắt cuộc trò chuyện. Vui lòng thử lại.`];
    }
  },

  /**
   * Get personalization insights for user
   */
  async getPersonalizationInsights(userId: string): Promise<string[]> {
    try {
      const data = await AIDatabase.getPersonalizationData(userId);
      
      if (!data) {
        return [`Chưa có đủ dữ liệu để phân tích. Hãy chat thêm nhé! 💬`];
      }

      const insightApiKey = process.env.GOOGLE_API_KEY;
      const ai = new GoogleGenAI({ apiKey: insightApiKey! });
      
      const insightChat = ai.chats.create({
        model: MODEL_NAME,
        config: {
          systemInstruction: `Bạn là trợ lý phân tích hành vi chat.
          Nhiệm vụ: Đưa ra nhận xét thú vị và gợi ý dựa trên dữ liệu.
          - Nhận xét về thói quen chat
          - Gợi ý cải thiện giao tiếp
          - Giữ giọng điệu vui vẻ, thân thiện
          - Trả lời bằng tiếng Việt, dưới 100 từ`,
        },
      });

      const dataText = `
        Người chat nhiều nhất: ${data.mostChattedWith?.name || 'Chưa có'}
        Số tin nhắn với người đó: ${data.mostChattedWith?.totalMessages || 0}
        Giờ hoạt động cao nhất: ${data.chatHabits.peakHour}:00
        Ngày chat nhiều nhất: ${data.chatHabits.peakDay}
        Top 3 contacts: ${data.topContacts.slice(0, 3).map(c => c.name).join(', ')}
      `;

      const insightResult = await insightChat.sendMessage({
        message: `Phân tích và đưa ra nhận xét thú vị về thói quen chat:\n${dataText}`,
      });

      return [
        `🎯 Phân tích cá nhân hóa:\n`,
        insightResult.text || 'Không thể tạo phân tích.',
      ];
    } catch (error) {
      console.error('[AIService] getPersonalizationInsights error:', error);
      return [`❌ Không thể phân tích. Vui lòng thử lại.`];
    }
  },
};
