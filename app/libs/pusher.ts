import PusherServer from "pusher";
import PusherClient from "pusher-js";

// Server-side Pusher instance (singleton)
let pusherServerInstance: PusherServer | null = null;

export const pusherServer = (() => {
  if (!pusherServerInstance) {
    pusherServerInstance = new PusherServer({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: "ap1",
      useTLS: true,
    });
  }
  return pusherServerInstance;
})();

// Client-side Pusher instance - SINGLETON
let pusherClientInstance: PusherClient | null = null;

// Initialize client only once
const initPusherClient = (): PusherClient => {
  if (pusherClientInstance) {
    return pusherClientInstance;
  }

  console.log("[Pusher] Initializing client...");
  
  pusherClientInstance = new PusherClient(
    process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
    {
      channelAuthorization: {
        endpoint: "/api/pusher/auth",
        transport: "ajax",
      },
      cluster: "ap1",
      enabledTransports: ["ws", "wss"],
      disableStats: true,
      activityTimeout: 120000,
      pongTimeout: 30000,
    }
  );

  // Connection event handlers
  pusherClientInstance.connection.bind("connected", () => {
    console.log("[Pusher] Connected successfully");
  });

  pusherClientInstance.connection.bind("disconnected", () => {
    console.log("[Pusher] Disconnected");
  });

  pusherClientInstance.connection.bind("error", (err: Error) => {
    console.error("[Pusher] Connection error:", err);
  });

  pusherClientInstance.connection.bind("state_change", (states: { current: string; previous: string }) => {
    console.log(`[Pusher] State: ${states.previous} -> ${states.current}`);
  });

  return pusherClientInstance;
};

// Get Pusher client - always returns the same instance
export const getPusherClient = (): PusherClient => {
  if (typeof window === "undefined") {
    // SSR mock
    return {
      subscribe: () => ({
        bind: () => {},
        unbind: () => {},
      }),
      unsubscribe: () => {},
      connection: {
        state: "disconnected",
        bind: () => {},
        unbind: () => {},
      },
      connect: () => {},
      disconnect: () => {},
    } as unknown as PusherClient;
  }

  return initPusherClient();
};

// Note: Use getPusherClient() instead of pusherClient for proper initialization

// Check if connected
export const isPusherConnected = (): boolean => {
  if (typeof window === "undefined") return false;
  return pusherClientInstance?.connection?.state === "connected";
};

// Ensure connection
export const ensurePusherConnection = (): void => {
  if (typeof window === "undefined") return;
  
  const client = getPusherClient();
  const state = client.connection.state;
  
  if (state !== "connected" && state !== "connecting") {
    console.log("[Pusher] Reconnecting from state:", state);
    client.connect();
  }
};
