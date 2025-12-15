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
      <div className="bg-white w-full flex border-b sm:px-4 py-3 px-4 lg:px-6 justify-between items-center shadow-sm">
        <div className="flex gap-3 items-center">
          <Link
            className="lg:hidden block text-sky-500 hover:text-sky-600 transition cursor-pointer"
            href="/conversations"
            prefetch={false}
          >
            <HiChevronLeft size={32} />
          </Link>
          {conversation.isGroup ? (
            <AvatarGroup users={conversation.users} groupImage={conversation.image} />
          ) : (
            <Avatar user={otherUser} />
          )}
          <div className="flex flex-col">
            <div className="font-medium">{displayName}</div>
            <div className="text-sm font-light text-neutral-500">{statusText}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Call buttons */}
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
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Open conversation details"
          >
            <HiEllipsisHorizontal
              size={32}
              className="text-sky-500 cursor-pointer hover:text-sky-600 transition"
            />
          </button>
        </div>
      </div>
    </>
  );
};

export default memo(Header);
