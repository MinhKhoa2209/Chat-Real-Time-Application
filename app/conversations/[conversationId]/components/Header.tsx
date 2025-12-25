"use client";

import { Conversation, User } from "@prisma/client";
import useOtherUser from "@/app/hooks/useOtherUser";
import { useMemo, useState, useEffect, useCallback, memo } from "react";
import Link from "next/link";
import { HiChevronLeft, HiEllipsisHorizontal } from "react-icons/hi2";
import Avatar from "@/app/components/Avatar";
import ProfileDrawer from "./ProfileDrawer";
import AvatarGroup from "@/app/components/AvatarGroup";
import useActiveList from "@/app/hooks/useActiveList";
import { getPusherClient } from "@/app/libs/pusher";
import { useSession } from "next-auth/react";
import axios from "axios";
import CallButtons from "@/app/components/call/CallButtons";
import clsx from "clsx";

interface HeaderProps {
  conversation: Conversation & {
    users: User[];
    image?: string | null;
  };
}

const Header: React.FC<HeaderProps> = ({ conversation: initialConversation }) => {
  const [conversation, setConversation] = useState(initialConversation);
  const otherUser = useOtherUser(conversation);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { members } = useActiveList();
  const session = useSession();

  // Memoized handlers
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Listen for conversation updates
  useEffect(() => {
    const email = session.data?.user?.email;
    if (!email) return;

    const pusherClient = getPusherClient();
    const channel = pusherClient.subscribe(email);

    const updateHandler = async (updatedConversation: Conversation & { users?: User[]; imageUpdated?: boolean; image?: string | null }) => {
      if (!updatedConversation || updatedConversation.id !== conversation.id) return;

      if (updatedConversation.imageUpdated) {
        try {
          const response = await axios.get(`/api/conversations/${conversation.id}`);
          setConversation((current) => ({ ...current, ...response.data }));
          return;
        } catch {}
      }

      // Only update fields that are explicitly provided (not undefined)
      setConversation((current) => ({
        ...current,
        // Preserve existing values if new values are undefined/null
        name: updatedConversation.name !== undefined ? updatedConversation.name : current.name,
        isGroup: updatedConversation.isGroup !== undefined ? updatedConversation.isGroup : current.isGroup,
        image: updatedConversation.image !== undefined ? updatedConversation.image : current.image,
        users: updatedConversation.users && updatedConversation.users.length > 0 
          ? updatedConversation.users 
          : current.users,
        lastMessageAt: updatedConversation.lastMessageAt || current.lastMessageAt,
      }));
    };

    channel.bind("conversation:update", updateHandler);
    return () => {
      channel.unbind("conversation:update", updateHandler);
    };
  }, [conversation.id, session.data?.user?.email]);

  // Memoized values
  const isGeminiBot = useMemo(() => otherUser?.email === "gemini@messenger.com", [otherUser?.email]);

  const isRealUserActive = useMemo(() => 
    otherUser?.email ? members.indexOf(otherUser.email) !== -1 : false,
    [otherUser?.email, members]
  );

  const isActive = isGeminiBot || isRealUserActive;

  const statusText = useMemo(() => {
    if (conversation.isGroup) {
      return `${conversation.users?.length || 0} members`;
    }
    if (isGeminiBot) return "Active";
    return isActive ? "Active" : "Offline";
  }, [conversation.isGroup, conversation.users?.length, isActive, isGeminiBot]);

  const displayName = useMemo(() => 
    conversation.name || otherUser?.name || "Conversation",
    [conversation.name, otherUser?.name]
  );

  return (
    <>
      <ProfileDrawer
        data={conversation}
        isOpen={drawerOpen}
        onClose={closeDrawer}
      />
      <div className="glass w-full flex border-b border-gray-200 dark:border-gray-800 sm:px-4 py-3 px-4 lg:px-6 justify-between items-center">
        <div className="flex gap-3 items-center">
          <Link
            className="lg:hidden block text-sky-500 hover:text-sky-600 transition cursor-pointer p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            href="/conversations"
            prefetch={false}
          >
            <HiChevronLeft size={28} />
          </Link>
          <div className="relative">
            {conversation.isGroup ? (
              <AvatarGroup users={conversation.users} groupImage={conversation.image} />
            ) : (
              <Avatar user={otherUser} />
            )}
          </div>
          <div className="flex flex-col">
            <div className="font-semibold text-gray-900 dark:text-white">{displayName}</div>
            <div className="flex items-center gap-1.5">
              {isActive && !conversation.isGroup && (
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              )}
              <span className={clsx(
                "text-xs",
                isActive ? "text-green-600 font-medium" : "text-gray-500"
              )}>
                {statusText}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {conversation.isGroup ? (
            <CallButtons
              users={conversation.users}
              conversationId={conversation.id}
              isGroup={true}
              groupName={conversation.name || "Nhóm"}
            />
          ) : otherUser && !isGeminiBot ? (
            <CallButtons
              otherUser={otherUser}
              conversationId={conversation.id}
              isGroup={false}
            />
          ) : null}
          <button
            onClick={openDrawer}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300"
            aria-label="Open conversation details"
          >
            <HiEllipsisHorizontal
              size={24}
              className="text-gray-500 dark:text-gray-400 cursor-pointer hover:text-sky-500 transition"
            />
          </button>
        </div>
      </div>
    </>
  );
};

export default memo(Header);
