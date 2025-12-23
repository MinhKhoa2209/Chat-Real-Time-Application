"use client";

import Avatar from "@/app/components/Avatar";
import useOtherUser from "@/app/hooks/useOtherUser";
import { FullConversationType } from "@/app/types";
import clsx from "clsx";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { format, isToday, isYesterday, isThisWeek, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { useCallback, useMemo } from "react";
import React from "react";
import AvatarGroup from "@/app/components/AvatarGroup";

interface ConversationBoxProps {
  data: FullConversationType;
  selected?: boolean;
}

const ConversationBox: React.FC<ConversationBoxProps> = ({
  data,
  selected,
}) => {
  const otherUser = useOtherUser(data);
  const session = useSession();
  const router = useRouter();

  const handleClick = useCallback(() => {
    router.push(`/conversations/${data.id}`);
  }, [data.id, router]);

  const lastMessage = useMemo(() => {
    const messages = data.messages || [];
    const userId = session.data?.user?.id;
    
    // Find the last message that is not hidden for current user
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i] as any;
      const hiddenForIds = msg.hiddenForIds || [];
      if (!hiddenForIds.includes(userId)) {
        return msg;
      }
    }
    return messages[messages.length - 1];
  }, [data.messages, session.data?.user?.id]);

  const userEmail = useMemo(() => {
    return session.data?.user?.email;
  }, [session.data?.user?.email]);

  const hasSeen = useMemo(() => {
    if (!lastMessage) {
      return true; // No message = nothing to see
    }

    // Own messages are always "seen"
    if (lastMessage.sender?.email === userEmail) {
      return true;
    }

    if (!userEmail) {
      return false;
    }

    // Check seenIds first (more reliable)
    const seenIds = (lastMessage as any).seenIds || [];
    const userId = session.data?.user?.id;
    if (userId && seenIds.includes(userId)) {
      return true;
    }

    // Fallback to seen array
    const seenArray = lastMessage.seen || [];
    return seenArray.some((user: any) => user.email === userEmail);
  }, [userEmail, lastMessage, session.data?.user?.id]);

  // Format time like Messenger
  const formattedTime = useMemo(() => {
    if (!lastMessage?.createdAt) return "";

    const date = new Date(lastMessage.createdAt);
    
    if (isToday(date)) {
      return format(date, "p"); // Hour:minute
    }
    
    if (isYesterday(date)) {
      return "Yesterday";
    }
    
    if (isThisWeek(date)) {
      return format(date, "EEEE"); 
    }
    
    return format(date, "dd/MM/yyyy"); 
  }, [lastMessage?.createdAt]);
  const lastMessageText = useMemo(() => {
    if (!lastMessage) {
      // Different text for groups vs 1-1 chats
      if (data.isGroup) {
        return "New group created";
      }
      return "Start a conversation";
    }

    // Check if message was unsent/deleted first
    if (lastMessage?.isDeleted) {
      return lastMessage.body || "Message has been unsent";
    }

    // Check for image - can be URL string or boolean flag
    if (lastMessage?.image) {
      return "Sent an image";
    }

    // Check for file - can be URL string or boolean flag
    if (lastMessage?.fileUrl) {
      const fileName = (lastMessage as any).fileName || "";
      // Check if it's a voice message
      if (fileName.includes("🎤") || fileName.toLowerCase().includes("voice")) {
        return "Sent a voice message";
      }
      return fileName ? `Sent a file: ${fileName}` : "Sent a file";
    }

    if (lastMessage?.body) {
      const body = lastMessage.body as string;
      
      // Check if this is an "added to group" message
      if (body.includes(" added ") && body.includes(" to the group")) {
        // First check addedMemberEmails from Pusher
        const addedMemberEmails = (lastMessage as any).addedMemberEmails || [];
        
        if (userEmail && addedMemberEmails.includes(userEmail)) {
          const senderName = lastMessage.sender?.name || "Someone";
          return `${senderName} added you to the group`;
        }
        
        // Fallback: Check if user's name is in the message body
        const userName = session.data?.user?.name;
        if (userName && body.includes(` added ${userName}`)) {
          const senderName = lastMessage.sender?.name || "Someone";
          return `${senderName} added you to the group`;
        }
      }
      return lastMessage.body;
    }

    // For groups without body (e.g., system messages)
    if (data.isGroup) {
      return "New group created";
    }
    return "Start a conversation";
  }, [lastMessage, userEmail, session.data?.user?.name, data.isGroup]);

  // Check if last message is unread (simplified for real-time updates)
  const hasUnread = useMemo(() => {
    if (!userEmail || !lastMessage) return false;
    
    // Own messages are always "read"
    if (lastMessage.sender?.email === userEmail) return false;
    
    // Check seenIds first (more reliable)
    const seenIds = (lastMessage as any).seenIds || [];
    const userId = session.data?.user?.id;
    if (userId && seenIds.includes(userId)) {
      return false;
    }
    
    // Fallback to seen array
    const seenArray = lastMessage.seen || [];
    const hasSeenByUser = seenArray.some((user: any) => user.email === userEmail);
    
    return !hasSeenByUser;
  }, [lastMessage, userEmail, session.data?.user?.id]);

  return (
    <div
      onClick={handleClick}
      className={clsx(
        "w-full relative flex items-center space-x-3 hover:bg-neutral-100 rounded-lg transition cursor-pointer p-3",
        selected ? "bg-neutral-100" : "bg-white"
      )}
    >
      {data.isGroup ? (
        <AvatarGroup users={data.users} groupImage={data.image} />
      ) : (
        <Avatar user={otherUser} />
      )}
      <div className="min-w-0 flex-1">
        <div className="focus:outline-none">
          <div className="flex justify-between items-center mb-1">
            <p className="text-md font-medium text-gray-900">
              {data.name || otherUser?.name || "Conversation"}
            </p>
            {formattedTime && (
              <p className="text-xs text-gray-400 font-light">
                {formattedTime}
              </p>
            )}
          </div>
          <div className="flex justify-between items-center">
            <p
              className={clsx(
                `truncate text-s flex-1`,
                hasSeen ? "text-gray-500" : "text-black font-medium"
              )}
            >
              {lastMessageText}
            </p>
            {hasUnread && (
              <div className="ml-2 flex-shrink-0 bg-sky-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                •
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default React.memo(ConversationBox);
