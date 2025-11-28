import { GoogleGenAI } from "@google/genai";
import prisma from "@/app/libs/prismadb";

const MODEL_NAME = "gemini-2.5-flash";

export const AIService = {
  async buildSystemPrompt(userId: string) {
    const memories = await prisma.aiMemory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const memoryText = memories.map((m) => `- ${m.content}`).join("\n");

    const knowledge = await prisma.aiKnowledge.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const knowledgeText = knowledge
      .map((k) => `• (${k.topic}) ${k.content}`)
      .join("\n");

    const now = new Date();
    const dateString = now.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    const timeString = now.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

    return `
    Bạn là trợ lý AI thông minh trong ứng dụng Messenger Clone.
    
    --- NGỮ CẢNH THỜI GIAN ---
    Hiện tại là: ${timeString}, ngày ${dateString} (Giờ Việt Nam).

    --- KÝ ỨC NGƯỜI DÙNG (MEMORY) ---
    ${memoryText || "Chưa có thông tin cá nhân."}

    --- CƠ SỞ DỮ LIỆU NỘI BỘ (RAG) ---
    ${knowledgeText || "Chưa có dữ liệu nội bộ."}

    --- NGUYÊN TẮC HOẠT ĐỘNG ---
    1. Ưu tiên RAG nếu câu hỏi thuộc về dữ liệu nội bộ.
    2. Nếu câu hỏi cần thông tin thực tế, hãy dùng Google Search (đã được kích hoạt).
    3. Cá nhân hóa dựa trên MEMORY.
    4. Nếu không có thông tin, trả lời "Mình không rõ vấn đề này".
    `;
  },

  async generateResponse(userId: string, userMessage: string) {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("Missing Google API Key");
    }

    const systemInstruction = await this.buildSystemPrompt(userId);

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

    const chat = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: systemInstruction,
        tools: [{ googleSearch: {} }] 
      },
      history: [
        { role: "model", parts: [{ text: "Chào bạn! Mình đã sẵn sàng hỗ trợ." }] },
      ],
    });

    try {
      const result = await chat.sendMessage({ message: userMessage });
      return result.text; 
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Xin lỗi, hiện tại mình đang gặp chút trục trặc. Bạn thử lại sau nhé!";
    }
  },

  async processAutoMemory(userId: string, message: string) {
    const isIntroducing = /(tên|gọi)\s*(mình|tui|tớ|em|anh)\s*(là|nhé)\s+/i.test(message);

    if (isIntroducing) {
      await prisma.aiMemory.create({
        data: {
          userId,
          content: message,
        },
      });
      return true;
    }

    return false;
  },
};