"use client";

import { Conversation, User } from "@prisma/client";
import useOtherUser from "@/app/hooks/useOtherUser";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { HiChevronLeft, HiEllipsisHorizontal } from "react-icons/hi2";
import Avatar from "@/app/components/Avatar";
import ProfileDrawer from "./ProfileDrawer";
import AvatarGroup from "@/app/components/AvatarGroup";
import useActiveList from "@/app/hooks/useActiveList";
import { pusherClient } from "@/app/libs/pusher";
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

  // Listen for conversation updates
  useEffect(() => {
    const email = session.data?.user?.email;
    if (!email) return;

    console.log("Header: Setting up listener for channel:", email);
    
    // Subscribe to channel (will reuse existing if already subscribed)
    const channel = pusherClient.subscribe(email);

    const updateHandler = async (updatedConversation: any) => {
      console.log("Header: Received update event");
      console.log("Header: Full data keys:", Object.keys(updatedConversation || {}));
      console.log("Header: Comparing IDs:", updatedConversation?.id, "vs", conversation.id);
      
      if (updatedConversation && updatedConversation.id === conversation.id) {
        console.log("Header: MATCH! Users array length:", updatedConversation.users?.length);
        
        // If imageUpdated flag is set, refetch to get the new image
        if (updatedConversation.imageUpdated) {
          console.log("Header: Image was updated, refetching...");
          try {
            const response = await axios.get(`/api/conversations/${conversation.id}`);
            const freshData = response.data;
            setConversation((current) => ({
              ...current,
              ...freshData,
            }));
            return;
          } catch (error) {
            console.error("Header: Failed to refetch conversation:", error);
          }
        }
        
        setConversation((current) => {
          const newConversation = {
            ...current,
            ...updatedConversation,
            users: updatedConversation.users || current.users,
            name: updatedConversation.name ?? current.name,
            image: updatedConversation.image ?? current.image,
          };
          console.log("Header: New conversation users count:", newConversation.users?.length);
          return newConversation;
        });
      }
    };

    channel.bind("conversation:update", updateHandler);

    return () => {
      channel.unbind("conversation:update", updateHandler);
    };
  }, [conversation.id, session.data?.user?.email]);

  const isGeminiBot = useMemo(() => {
    return otherUser?.email === 'gemini@messenger.com';
  }, [otherUser?.email]);

  const isRealUserActive = otherUser?.email ? members.indexOf(otherUser.email) !== -1 : false;
  
  const isActive = isGeminiBot || isRealUserActive;

  const statusText = useMemo(() => {
    if (conversation.isGroup) {
      return `${conversation.users?.length || 0} members`;
    }
    if (isGeminiBot) {
      return "Active"; 
    }

    return isActive ? "Active" : "Offline";
  }, [conversation, isActive, isGeminiBot]);

  return (
    <>
      <ProfileDrawer
        data={conversation}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <div className="bg-white w-full flex border-b sm:px-4 py-3 px-4 lg:px-6 justify-between items-center shadow-sm">
        <div className="flex gap-3 items-center">
          <Link
            className="lg:hidden block text-sky-500 hover:text-sky-600 transition cursor-pointer"
            href="/conversations"
          >
            <HiChevronLeft size={32} />
          </Link>
          {conversation.isGroup ? (
            <AvatarGroup users={conversation.users} groupImage={conversation.image} />
          ) : (
            <Avatar user={otherUser} /> 
          )}
          <div className="flex flex-col">
            <div>{conversation.name || otherUser?.name || "Conversation"}</div>
            <div className=" text-sm font-light text-neutral-500">
              {statusText}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!conversation.isGroup && otherUser && (
            <CallButtons
              otherUser={otherUser}
              conversationId={conversation.id}
              isGroup={conversation.isGroup || false}
            />
          )}
          <HiEllipsisHorizontal
            size={32}
            onClick={() => setDrawerOpen(true)}
            className="text-sky-500 cursor-pointer hover:text-sky-600 transition"
          />
        </div>
      </div>
    </>
  );
};

export default Header;