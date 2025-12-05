import { GoogleGenAI } from "@google/genai";
import prisma from "@/app/libs/prismadb";

const MODEL_NAME = "gemini-2.5-flash";
const IMAGE_MODEL = "imagen-3.0-generate-001";

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
    Bạn là trợ lý AI thông minh trong ứng dụng Messenger Clone với khả năng tìm kiếm thông tin mới nhất.
    
    --- NGỮ CẢNH THỜI GIAN ---
    Hiện tại là: ${timeString}, ngày ${dateString} (Giờ Việt Nam).

    --- USER MEMORY ---
    ${memoryText || "No personal information available."}

    --- CƠ SỞ DỮ LIỆU NỘI BỘ (RAG) ---
    ${knowledgeText || "No internal data available."}

    --- OPERATING PRINCIPLES ---
    1. **Prioritize RAG** if the question is about internal data.
    2. **Automatically use Google Search** when:
       - Questions about news, current events
       - Weather, prices, exchange rates
       - Information that needs real-time updates
       - Any information you're not sure about
    3. **Personalize** based on user's MEMORY.
    4. **Answer concisely** in natural, easy-to-understand language.
    5. **Break information** into short paragraphs for easy reading.
    `;
  },

  async generateResponse(userId: string, userMessage: string) {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("Missing Google API Key");
    }

    // Check if this is an image generation request
    const isImageRequest = this.detectImageRequest(userMessage);
    
    if (isImageRequest) {
      return await this.generateImage(userMessage);
    }

    const systemInstruction = await this.buildSystemPrompt(userId);

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

    const chat = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: systemInstruction,
        tools: [{ googleSearch: {} }], // Kích hoạt Google Search
        temperature: 0.7,
        topP: 0.95,
      },
      history: [
        { role: "model", parts: [{ text: "Hello! I'm ready to help." }] },
      ],
    });

    try {
      const result = await chat.sendMessage({ message: userMessage });
      const fullText = result.text || "";
      
      // Auto-save new knowledge if important information is detected
      this.autoSaveKnowledge(userMessage, fullText).catch(err => 
        console.error("Auto save knowledge error:", err)
      );
      
      // Split long messages into smaller chunks
      const messages = this.splitIntoMessages(fullText);
      return messages;
    } catch (error) {
      console.error("Gemini Error:", error);
      return ["Sorry, I'm experiencing some issues right now. Please try again later!"];
    }
  },

  /**
   * Phát hiện yêu cầu tạo ảnh
   */
  detectImageRequest(message: string): boolean {
    const imageKeywords = [
      /tạo\s+(ảnh|hình|tranh)/i,
      /vẽ\s+(cho|giúp|tôi|mình)/i,
      /thiết\s+kế\s+(ảnh|hình|logo)/i,
      /generate\s+(image|picture|photo)/i,
      /draw\s+(me|a|an)/i,
      /create\s+(image|picture|illustration)/i,
    ];
    
    return imageKeywords.some(pattern => pattern.test(message));
  },

  /**
   * Tạo ảnh bằng Gemini Imagen
   * Lưu ý: Imagen API có thể chưa khả dụng trong một số region
   */
  async generateImage(userMessage: string): Promise<string[]> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });
      
      // Create detailed English prompt from user request
      const promptChat = ai.chats.create({
        model: MODEL_NAME,
        config: {
          systemInstruction: `You are an expert at creating prompts for AI image generation. 
          Task: Convert user requests into detailed English prompts with clear descriptions.
          Only return the prompt, no additional explanation.`,
        },
      });

      const promptResult = await promptChat.sendMessage({ 
        message: `Create a detailed English prompt for: ${userMessage}` 
      });
      
      const imagePrompt = promptResult.text || userMessage;

      // Thử các endpoint khác nhau của Imagen
      const endpoints = [
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict`,
        `https://generativelanguage.googleapis.com/v1/models/imagen-3.0-generate-001:generateImages`,
        `https://generativelanguage.googleapis.com/v1beta/models/imagegeneration@006:predict`,
      ];

      let lastError = null;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": process.env.GOOGLE_API_KEY!,
            },
            body: JSON.stringify({
              prompt: imagePrompt,
              numberOfImages: 1,
              aspectRatio: "1:1",
            }),
          });

          if (response.ok) {
            const result = await response.json();
            
            // Handle different response formats
            if (result.generatedImages && result.generatedImages.length > 0) {
              const imageData = result.generatedImages[0];
              return [
                `🎨 Image created successfully!`,
                `IMAGE_DATA:data:image/png;base64,${imageData.bytesBase64Encoded}`,
              ];
            } else if (result.predictions && result.predictions.length > 0) {
              const imageData = result.predictions[0];
              return [
                `🎨 Image created successfully!`,
                `IMAGE_DATA:data:image/png;base64,${imageData.bytesBase64Encoded}`,
              ];
            }
          }
        } catch (err) {
          lastError = err;
          continue; // Try next endpoint
        }
      }

      // If all endpoints fail, return prompt for user to use with other tools
      return [
        `🎨 Sorry, automatic image generation is not available yet.`,
        `💡 You can use this prompt with other AI tools:`,
        `"${imagePrompt}"`,
        `\n📌 Suggestion: Try with DALL-E, Midjourney, or Stable Diffusion`,
      ];
    } catch (error) {
      console.error("Image generation error:", error);
      return [
        "Sorry, image generation feature is experiencing issues.",
        "This feature may not be available in your region yet.",
      ];
    }
  },

  /**
   * Automatically save new knowledge from conversation
   */
  async autoSaveKnowledge(question: string, answer: string) {
    // Only save if question has important keywords
    const importantKeywords = [
      /là gì/i, /nghĩa là/i, /định nghĩa/i,
      /ở đâu/i, /khi nào/i, /như thế nào/i,
      /giá/i, /chi phí/i, /thời gian/i,
      /cách/i, /hướng dẫn/i,
    ];

    const isImportant = importantKeywords.some(pattern => pattern.test(question));
    
    if (!isImportant || answer.length < 50 || answer.length > 1000) {
      return;
    }

    // Extract topic from question
    const topic = question.substring(0, 100).trim();

    try {
      // Check if similar knowledge already exists
      const existing = await prisma.aiKnowledge.findFirst({
        where: {
          topic: {
            contains: topic.substring(0, 50),
          },
        },
      });

      if (!existing) {
        await prisma.aiKnowledge.create({
          data: {
            topic,
            content: answer.substring(0, 500), // Limit length
          },
        });
        console.log("✅ Auto-saved new knowledge:", topic);
      }
    } catch (error) {
      console.error("Auto save knowledge error:", error);
    }
  },

  /**
   * Split long text into smaller messages
   * Prioritize splitting by paragraphs, then by sentences
   */
  splitIntoMessages(text: string): string[] {
    if (!text || text.trim().length === 0) {
      return [""];
    }

    // Remove extra whitespace
    const cleanText = text.trim();

    // Split by paragraphs (2 consecutive line breaks)
    const paragraphs = cleanText.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    const messages: string[] = [];
    const MAX_LENGTH = 500; // Maximum length per message

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      
      // If paragraph is short, keep it as is
      if (trimmedParagraph.length <= MAX_LENGTH) {
        messages.push(trimmedParagraph);
        continue;
      }

      // If paragraph is long, split by sentences
      const sentences = trimmedParagraph.split(/([.!?]\s+)/).filter(s => s.trim().length > 0);
      let currentMessage = "";

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        
        // If adding this sentence doesn't exceed limit
        if ((currentMessage + sentence).length <= MAX_LENGTH) {
          currentMessage += sentence;
        } else {
          // Save current message if it has content
          if (currentMessage.trim().length > 0) {
            messages.push(currentMessage.trim());
          }
          // Start new message
          currentMessage = sentence;
        }
      }

      // Add remaining part
      if (currentMessage.trim().length > 0) {
        messages.push(currentMessage.trim());
      }
    }

    // If no messages, return original text
    return messages.length > 0 ? messages : [cleanText];
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