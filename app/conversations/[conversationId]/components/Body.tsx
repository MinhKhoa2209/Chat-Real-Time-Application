"use client";

import useConversation from "@/app/hooks/useConversation";
import { FullMessageType } from "@/app/types";
import { useEffect, useRef, useState, useMemo, useCallback, memo } from "react";
import MessageBox from "./MessageBox";
import axios from "axios";
import { getPusherClient } from "@/app/libs/pusher";
import { find } from "lodash";
import { useConversationContext } from "../ConversationContext";

interface BodyProps {
  initialMessages: FullMessageType[];
}

const AI_SENDER_IDENTIFIER = "6926f7de1fca804c3b97f53c";

// Memoized MessageBox wrapper
const MemoizedMessageBox = memo(MessageBox);

const Body: React.FC<BodyProps> = ({ initialMessages }) => {
  const [messages, setMessages] = useState(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { conversationId } = useConversation();
  const { setReplyTo } = useConversationContext();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const seenSentRef = useRef(false);

  // Get current user ID - only once
  useEffect(() => {
    axios.get("/api/user/me")
      .then((res) => setCurrentUserId(res.data.id))
      .catch(() => {});
  }, []);

  const isBotMessage = useCallback((message: FullMessageType): boolean => {
    return message.sender?.id === AI_SENDER_IDENTIFIER;
  }, []);

  // Optimized message sorting with memoization
  const sortedMessages = useMemo(() => {
    const visibleMessages = messages.filter((message: FullMessageType & { hiddenForIds?: string[] }) => {
      if (!currentUserId) return true;
      const hiddenForIds = message.hiddenForIds || [];
      return !hiddenForIds.includes(currentUserId);
    });

    return visibleMessages.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      const timeDiff = timeA - timeB;

      if (timeDiff !== 0) return timeDiff;

      const isBotA = isBotMessage(a);
      const isBotB = isBotMessage(b);

      if (isBotA && !isBotB) return 1;
      if (!isBotA && isBotB) return -1;

      return a.id.localeCompare(b.id);
    });
  }, [messages, currentUserId, isBotMessage]);

  // Debounced seen API call - only once per conversation
  useEffect(() => {
    if (seenSentRef.current) return;
    seenSentRef.current = true;

    const timer = setTimeout(() => {
      axios.post(`/api/conversations/${conversationId}/seen`).catch(() => {});
    }, 300);

    return () => clearTimeout(timer);
  }, [conversationId]);

  // Pusher subscription with optimized handlers
  useEffect(() => {
    if (!conversationId) return;

    const pusherClient = getPusherClient();
    const channel = pusherClient.subscribe(conversationId);

    // Scroll to bottom on mount
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    });

    const messageHandler = (message: FullMessageType) => {
      // Mark as seen - non-blocking
      axios.post(`/api/conversations/${conversationId}/seen`).catch(() => {});

      setMessages((current) => {
        if (find(current, { id: message.id })) return current;

        // Preserve replyTo sender if missing
        if (message.replyTo && !message.replyTo.sender) {
          const replyToMessage = current.find((m) => m.id === message.replyTo?.id);
          if (replyToMessage) {
            message.replyTo = { ...message.replyTo, sender: replyToMessage.sender };
          }
        }

        return [...current, message];
      });

      // Smooth scroll with requestAnimationFrame
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    };

    const updateMessageHandler = (newMessage: FullMessageType) => {
      setMessages((current) =>
        current.map((currentMessage) => {
          if (currentMessage.id === newMessage.id) {
            // IMPORTANT: Preserve existing data if update doesn't include it
            return {
              ...currentMessage,
              ...newMessage,
              // Always preserve sender from current message if update doesn't have it
              sender: newMessage.sender || currentMessage.sender,
              // Preserve other important fields
              replyTo: newMessage.replyTo || currentMessage.replyTo,
              seen: newMessage.seen?.length ? newMessage.seen : currentMessage.seen,
              image: newMessage.image !== undefined ? newMessage.image : currentMessage.image,
              body: newMessage.body !== undefined ? newMessage.body : currentMessage.body,
            };
          }
          return currentMessage;
        })
      );
    };

    const hideMessageHandler = (data: { messageId: string; userId: string }) => {
      if (data.userId !== currentUserId) return;

      setMessages((current) =>
        current.map((message: FullMessageType & { hiddenForIds?: string[] }) => {
          if (message.id === data.messageId) {
            return {
              ...message,
              hiddenForIds: [...(message.hiddenForIds || []), data.userId],
            };
          }
          return message;
        })
      );
    };

    channel.bind("messages:new", messageHandler);
    channel.bind("message:update", updateMessageHandler);
    channel.bind("message:hide", hideMessageHandler);

    return () => {
      channel.unbind("messages:new", messageHandler);
      channel.unbind("message:update", updateMessageHandler);
      channel.unbind("message:hide", hideMessageHandler);
      getPusherClient().unsubscribe(conversationId);
    };
  }, [conversationId, currentUserId]);

  return (
    <div className="flex-1 overflow-y-auto">
      {sortedMessages.map((message, i) => (
        <MemoizedMessageBox
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

export default memo(Body);
