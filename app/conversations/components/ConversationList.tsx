"use client";

import useConversation from "@/app/hooks/useConversation";
import { FullConversationType } from "@/app/types";
import { MdOutlineGroupAdd } from "react-icons/md";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useCallback, memo } from "react";
import ConversationBox from "./ConversationBox";
import GroupChatModal from "./GroupChatModal";
import { getPusherClient } from "@/app/libs/pusher";
import { useSession } from "next-auth/react";
import { find } from "lodash";

interface ConversationListProps {
  initialItems: FullConversationType[];
  users: any[];
}

// Memoized ConversationBox
const MemoizedConversationBox = memo(ConversationBox);

const ConversationList: React.FC<ConversationListProps> = ({
  initialItems,
  users,
}) => {
  const { data: sessionData } = useSession();
  const [items, setItems] = useState(initialItems || []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();
  const { conversationId, isOpen } = useConversation();

  const pusherKey = useMemo(() => sessionData?.user?.email, [sessionData?.user?.email]);

  // Memoized handlers
  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  // Optimized Pusher subscription
  useEffect(() => {
    if (!pusherKey) return;

    const pusherClient = getPusherClient();
    const channel = pusherClient.subscribe(pusherKey);

    const newHandler = (conversation: FullConversationType) => {
      setItems((current) => {
        const existing = find(current, { id: conversation.id });
        if (existing) {
          return current.map((item) =>
            item.id === conversation.id
              ? { ...conversation, messages: conversation.messages || item.messages }
              : item
          );
        }
        return [conversation, ...current];
      });
    };

    const updateHandler = async (conversation: FullConversationType & { imageUpdated?: boolean }) => {
      // Fetch fresh data if image updated
      if (conversation.imageUpdated && conversation.id) {
        try {
          const response = await fetch(`/api/conversations/${conversation.id}`);
          if (response.ok) {
            const freshData = await response.json();
            conversation = { ...conversation, image: freshData.image };
          }
        } catch {}
      }

      setItems((current) => {
        const updated = current.map((currentConversation) => {
          if (currentConversation.id !== conversation.id) return currentConversation;

          const currentMessages = currentConversation.messages || [];
          const newMessages = conversation.messages || [];

          const baseUpdate = {
            ...currentConversation,
            name: conversation.name ?? currentConversation.name,
            image: conversation.image ?? currentConversation.image,
            // Only update users if new array has items, otherwise keep current
            users: conversation.users && conversation.users.length > 0 
              ? conversation.users 
              : currentConversation.users,
            isGroup: conversation.isGroup ?? currentConversation.isGroup,
            lastMessageAt: conversation.lastMessageAt || currentConversation.lastMessageAt,
          };

          if (newMessages.length === 0) return baseUpdate;

          // Merge messages efficiently
          const existingMessageIds = new Set(currentMessages.map((m) => m.id));
          const messagesToAdd = newMessages.filter((m) => !existingMessageIds.has(m.id));
          const updatedMessages = currentMessages.map((existingMsg) => {
            const updatedMsg = newMessages.find((m) => m.id === existingMsg.id);
            if (!updatedMsg) return existingMsg;
            
            // Merge seen arrays properly - combine existing and new seen users
            const existingSeen = existingMsg.seen || [];
            const newSeen = updatedMsg.seen || [];
            const seenMap = new Map();
            [...existingSeen, ...newSeen].forEach((user: any) => {
              if (user?.id) seenMap.set(user.id, user);
            });
            const mergedSeen = Array.from(seenMap.values());

            return {
              ...existingMsg,
              ...updatedMsg,
              replyTo: updatedMsg.replyTo || existingMsg.replyTo,
              reactions: updatedMsg.reactions || existingMsg.reactions || [],
              seen: mergedSeen,
              seenIds: updatedMsg.seenIds || existingMsg.seenIds || [],
            };
          });

          return { ...baseUpdate, messages: [...updatedMessages, ...messagesToAdd] };
        });

        // Check if conversation was updated or needs to be added
        const wasUpdated = updated.some((c) => c.id === conversation.id);
        if (!wasUpdated) {
          // If conversation doesn't have users, it's a partial update - don't add it
          if (!conversation.users || conversation.users.length === 0) {
            return updated;
          }
          return [conversation, ...updated];
        }

        // Sort by last message time
        return updated.sort((a, b) => {
          const aLast = a.messages?.[a.messages.length - 1];
          const bLast = b.messages?.[b.messages.length - 1];
          const aTime = aLast?.createdAt ? new Date(aLast.createdAt).getTime() : 0;
          const bTime = bLast?.createdAt ? new Date(bLast.createdAt).getTime() : 0;
          return bTime - aTime;
        });
      });
    };

    const removeHandler = (conversation: FullConversationType) => {
      setItems((current) => current.filter((convo) => convo.id !== conversation.id));
      if (conversationId === conversation.id) {
        router.push("/conversations");
      }
    };

    channel.bind("conversation:new", newHandler);
    channel.bind("conversation:update", updateHandler);
    channel.bind("conversation:remove", removeHandler);

    return () => {
      channel.unbind("conversation:new", newHandler);
      channel.unbind("conversation:update", updateHandler);
      channel.unbind("conversation:remove", removeHandler);
      // Don't unsubscribe - other components use this channel
    };
  }, [pusherKey, conversationId, router]);

  // Count conversations with unread messages (based on last message)
  const totalUnreadCount = useMemo(() => {
    const userEmail = sessionData?.user?.email;
    const userId = (sessionData?.user as any)?.id;
    if (!userEmail) return 0;

    return items.reduce((total, conversation) => {
      const messages = conversation.messages || [];
      
      // Find last message not hidden for current user
      let lastMessage = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i] as any;
        const hiddenForIds = msg.hiddenForIds || [];
        if (!hiddenForIds.includes(userId)) {
          lastMessage = msg;
          break;
        }
      }
      
      if (!lastMessage) return total;
      
      // Own messages are always "read"
      if (lastMessage.sender?.email === userEmail) return total;
      
      // Check if user has seen the last message
      const seenArray = lastMessage.seen || [];
      const hasSeenByUser = seenArray.some((user: any) => user.email === userEmail);
      
      return hasSeenByUser ? total : total + 1;
    }, 0);
  }, [items, sessionData?.user]);

  return (
    <>
      <GroupChatModal users={users} isOpen={isModalOpen} onClose={closeModal} />
      <aside
        className={clsx(
          "fixed inset-y-0 pb-20 lg:pb-0 lg:left-20 lg:w-80 lg:block overflow-y-auto border-r border-gray-200",
          isOpen ? "hidden" : "block w-full left-0"
        )}
      >
        <div className="px-5">
          <div className="flex justify-between mb-4 pt-4 items-center">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-neutral-800">Messages</div>
              {totalUnreadCount > 0 && (
                <div className="bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center">
                  {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                </div>
              )}
            </div>
            <button
              onClick={openModal}
              className="rounded-full p-2 bg-gray-100 text-gray-600 cursor-pointer hover:opacity-75 transition-opacity"
              aria-label="Create group chat"
            >
              <MdOutlineGroupAdd size={20} />
            </button>
          </div>
          {items.length === 0 ? (
            <div className="text-center text-gray-400 py-12 px-4">
              <svg
                className="w-16 h-16 mx-auto mb-4 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="text-xs mt-1">Click the + button to start chatting</p>
            </div>
          ) : (
            items.map((item) => (
              <MemoizedConversationBox
                key={item.id}
                data={item}
                selected={conversationId === item.id}
              />
            ))
          )}
        </div>
      </aside>
    </>
  );
};

export default memo(ConversationList);
