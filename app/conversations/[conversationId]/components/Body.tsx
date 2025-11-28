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

  const isBotMessage = (message: FullMessageType): boolean => {
    return message.sender.id === AI_SENDER_IDENTIFIER;
  };

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
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
  }, [messages]);

  useEffect(() => {
    axios.post(`/api/conversations/${conversationId}/seen`);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      return;
    }
    pusherClient.subscribe(conversationId);
    bottomRef?.current?.scrollIntoView();

    const messageHandler = (message: FullMessageType) => {
      axios.post(`/api/conversations/${conversationId}/seen`);

      setMessages((current) => {
        if (find(current, { id: message.id })) {
          return current;
        }
        return [...current, message];
      });

      bottomRef?.current?.scrollIntoView();
    };

    const updateMessageHandler = (newMessage: FullMessageType) => {
      setMessages((current) =>
        current.map((currentMessage) => {
          if (currentMessage.id === newMessage.id) {
            return newMessage;
          }
          return currentMessage;
        })
      );
    };

    pusherClient.bind("messages:new", messageHandler);
    pusherClient.bind("message:update", updateMessageHandler);

    return () => {
      pusherClient.unsubscribe(conversationId);
      pusherClient.unbind("messages:new", messageHandler);
      pusherClient.unbind("message:update", updateMessageHandler);
    };
  }, [conversationId]);

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
