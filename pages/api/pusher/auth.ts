import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";

import { pusherServer } from "@/app/libs/pusher";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Cache for session to reduce auth overhead
const sessionCache = new Map<string, { session: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse
) {
  try {
    // Get session with caching
    const sessionKey = request.headers.cookie || "";
    const cached = sessionCache.get(sessionKey);
    
    let session;
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      session = cached.session;
    } else {
      session = await getServerSession(request, response, authOptions);
      if (session) {
        sessionCache.set(sessionKey, { session, timestamp: Date.now() });
      }
    }

    if (!session?.user?.email) {
      return response.status(401).json({ error: "Unauthorized" });
    }

    const socketId = request.body.socket_id;
    const channel = request.body.channel_name;

    if (!socketId || !channel) {
      return response.status(400).json({ error: "Missing required fields" });
    }

    const data = {
      user_id: session.user.email,
    };

    const authResponse = pusherServer.authorizeChannel(socketId, channel, data);
    return response.send(authResponse);
  } catch (error) {
    console.error("[PUSHER_AUTH] Error:", error);
    return response.status(500).json({ error: "Internal error" });
  }
}
