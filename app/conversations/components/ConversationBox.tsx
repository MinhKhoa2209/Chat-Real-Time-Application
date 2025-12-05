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
    return messages[messages.length - 1];
  }, [data.messages]);

  const userEmail = useMemo(() => {
    return session.data?.user?.email;
  }, [session.data?.user?.email]);

  const hasSeen = useMemo(() => {
    if (!lastMessage) {
      return false;
    }

    const seenArray = lastMessage.seen || [];

    if (!userEmail) {
      return false;
    }

    return seenArray.filter((user: any) => user.email === userEmail).length !== 0;
  }, [userEmail, lastMessage]);

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
    if (lastMessage?.image) {
      return "Sent an image";
    }

    if (lastMessage?.fileUrl) {
      return "Sent a file";
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
        // Get current user's name from session or extract from body
        const userName = session.data?.user?.name;
        if (userName && body.includes(` added ${userName}`)) {
          const senderName = lastMessage.sender?.name || "Someone";
          return `${senderName} added you to the group`;
        }
      }
      return lastMessage.body;
    }

    return "Start a conversation";
  }, [lastMessage, userEmail, session.data?.user?.name]);

  const unreadCount = useMemo(() => {
    if (!userEmail) return 0;

    const messages = data.messages || [];
    const unread = messages.filter((message: any) => {
      const seenArray = message.seen || [];
      const hasSeenByUser = seenArray.some((user: any) => user.email === userEmail);
      const isOwnMessage = message.sender?.email === userEmail;
      return !isOwnMessage && !hasSeenByUser;
    });

    return unread.length;
  }, [data.messages, userEmail]);

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
              {data.name || otherUser.name}
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
            {unreadCount > 0 && (
              <div className="ml-2 flex-shrink-0 bg-sky-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default React.memo(ConversationBox);
