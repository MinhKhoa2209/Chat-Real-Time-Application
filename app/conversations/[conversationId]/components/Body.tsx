"use client";

import useConversation from "@/app/hooks/useConversation";
import { FullMessageType } from "@/app/types";
import { useEffect, useRef, useState, useMemo } from "react";
import MessageBox from "./MessageBox";
import axios from "axios";
import { pusherClient } from "@/app/libs/pusher";
import { find } from "lodash";
import { useConversationContext } from "../ConversationContext";

interface BodyProps {
  initialMessages: FullMessageType[];
}

const AI_SENDER_IDENTIFIER = "6926f7de1fca804c3b97f53c";

const Body: React.FC<BodyProps> = ({ initialMessages }) => {
  const [messages, setMessages] = useState(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { conversationId } = useConversation();
  const { setReplyTo } = useConversationContext();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user ID
  useEffect(() => {
    axios.get("/api/user/me")
      .then((res) => setCurrentUserId(res.data.id))
      .catch((err) => console.error("Failed to get user:", err));
  }, []);

  const isBotMessage = (message: FullMessageType): boolean => {
    return message.sender.id === AI_SENDER_IDENTIFIER;
  };

  const sortedMessages = useMemo(() => {
    // Filter out hidden messages for current user
    const visibleMessages = messages.filter((message: any) => {
      if (!currentUserId) return true;
      const hiddenForIds = message.hiddenForIds || [];
      return !hiddenForIds.includes(currentUserId);
    });

    return visibleMessages.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      const timeDiff = timeA - timeB;

      if (timeDiff !== 0) {
        return timeDiff;
      }

      const isBotA = isBotMessage(a);
      const isBotB = isBotMessage(b);

      if (isBotA && !isBotB) {
        return 1;
      }
      if (!isBotA && isBotB) {
        return -1;
      }

      return a.id.localeCompare(b.id);
    });
  }, [messages, currentUserId]);

  useEffect(() => {
    // Debounce seen API call
    const timer = setTimeout(() => {
      axios.post(`/api/conversations/${conversationId}/seen`).catch(() => {});
    }, 500);
    
    return () => clearTimeout(timer);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      return;
    }
    
    const channel = pusherClient.subscribe(conversationId);
    
    bottomRef?.current?.scrollIntoView({ behavior: 'smooth' });

    const messageHandler = (message: FullMessageType) => {
      // Mark as seen asynchronously without blocking UI
      axios.post(`/api/conversations/${conversationId}/seen`).catch(() => {});

      setMessages((current) => {
        if (find(current, { id: message.id })) {
          return current;
        }
        
        // If message has replyTo but no sender, try to find it from existing messages
        if (message.replyTo && !message.replyTo.sender) {
          const replyToMessage = current.find(m => m.id === message.replyTo?.id);
          if (replyToMessage) {
            message.replyTo = {
              ...message.replyTo,
              sender: replyToMessage.sender,
            };
          }
        }
        
        return [...current, message];
      });

      // Smooth scroll to bottom
      setTimeout(() => {
        bottomRef?.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    };

    const updateMessageHandler = (newMessage: FullMessageType) => {
      setMessages((current) =>
        current.map((currentMessage) => {
          if (currentMessage.id === newMessage.id) {
            // Preserve replyTo if the update doesn't include it
            if (!newMessage.replyTo && currentMessage.replyTo) {
              return {
                ...newMessage,
                replyTo: currentMessage.replyTo,
              };
            }
            return newMessage;
          }
          return currentMessage;
        })
      );
    };

    const hideMessageHandler = (data: { messageId: string; userId: string }) => {
      // Only hide for the user who triggered it
      if (data.userId === currentUserId) {
        setMessages((current) =>
          current.map((message: any) => {
            if (message.id === data.messageId) {
              return {
                ...message,
                hiddenForIds: [...(message.hiddenForIds || []), data.userId],
              };
            }
            return message;
          })
        );
      }
    };

    channel.bind("messages:new", messageHandler);
    channel.bind("message:update", updateMessageHandler);
    channel.bind("message:hide", hideMessageHandler);

    return () => {
      channel.unbind("messages:new", messageHandler);
      channel.unbind("message:update", updateMessageHandler);
      channel.unbind("message:hide", hideMessageHandler);
      pusherClient.unsubscribe(conversationId);
    };
  }, [conversationId, currentUserId]);

  return (
    <div className="flex-1 overflow-y-auto">
      {sortedMessages.map((message, i) => (
        <MessageBox
          isLast={i === sortedMessages.length - 1}
          key={message.id}
          data={message}
          setReplyTo={setReplyTo}
        />
      ))}
      <div ref={bottomRef} className="pt-24" />
    </div>
  );
};

export default Body;
