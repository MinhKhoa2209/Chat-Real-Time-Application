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

// ConversationBox with proper comparison
const MemoizedConversationBox = memo(ConversationBox, (prevProps, nextProps) => {
  // Re-render if selected state changes
  if (prevProps.selected !== nextProps.selected) return false;
  
  // Re-render if conversation id changes
  if (prevProps.data.id !== nextProps.data.id) return false;
  
  // Re-render if lastMessageAt changes
  const prevTime = prevProps.data.lastMessageAt ? new Date(prevProps.data.lastMessageAt).getTime() : 0;
  const nextTime = nextProps.data.lastMessageAt ? new Date(nextProps.data.lastMessageAt).getTime() : 0;
  if (prevTime !== nextTime) return false;
  
  // Re-render if messages array length changes
  const prevMsgLen = prevProps.data.messages?.length || 0;
  const nextMsgLen = nextProps.data.messages?.length || 0;
  if (prevMsgLen !== nextMsgLen) return false;
  
  // Re-render if last message id changes
  const prevLastMsgId = prevProps.data.messages?.[prevMsgLen - 1]?.id;
  const nextLastMsgId = nextProps.data.messages?.[nextMsgLen - 1]?.id;
  if (prevLastMsgId !== nextLastMsgId) return false;
  
  // Re-render if last message body changes (for unsend)
  const prevLastMsgBody = prevProps.data.messages?.[prevMsgLen - 1]?.body;
  const nextLastMsgBody = nextProps.data.messages?.[nextMsgLen - 1]?.body;
  if (prevLastMsgBody !== nextLastMsgBody) return false;
  
  // Re-render if last message isDeleted changes
  const prevLastMsgDeleted = prevProps.data.messages?.[prevMsgLen - 1]?.isDeleted;
  const nextLastMsgDeleted = nextProps.data.messages?.[nextMsgLen - 1]?.isDeleted;
  if (prevLastMsgDeleted !== nextLastMsgDeleted) return false;
  
  // Re-render if name or image changes
  if (prevProps.data.name !== nextProps.data.name) return false;
  if (prevProps.data.image !== nextProps.data.image) return false;
  
  return true; // Don't re-render
});

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

    console.log('[ConversationList] Subscribed to channel:', pusherKey);

    const newHandler = (conversation: FullConversationType) => {
      console.log('[ConversationList] New conversation received:', conversation.id);
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

    const updateHandler = (conversation: FullConversationType & { imageUpdated?: boolean }) => {
      console.log('[ConversationList] Update received:', conversation.id, 'isGroup:', conversation.isGroup);
      console.log('[ConversationList] New messages:', conversation.messages?.length, conversation.messages?.[0]?.body?.substring(0, 30));
      
      setItems((current) => {
        // Find existing conversation
        const existingIndex = current.findIndex(c => c.id === conversation.id);
        console.log('[ConversationList] Existing index:', existingIndex);
        
        if (existingIndex === -1) {
          // New conversation - add to top if it has users
          if (!conversation.users || conversation.users.length === 0) {
            return current;
          }
          return [conversation, ...current];
        }

        // Update existing conversation
        const existingConversation = current[existingIndex];
        const currentMessages = existingConversation.messages || [];
        const newMessages = conversation.messages || [];

        // Merge messages - add new messages to existing ones
        let mergedMessages = [...currentMessages];
        
        if (newMessages.length > 0) {
          const existingMessageIds = new Set(currentMessages.map((m) => m.id));
          
          // Add new messages that don't exist
          const messagesToAdd = newMessages.filter((m) => !existingMessageIds.has(m.id));
          if (messagesToAdd.length > 0) {
            console.log('[ConversationList] Adding', messagesToAdd.length, 'new messages');
            mergedMessages = [...mergedMessages, ...messagesToAdd];
          }
          
          // Update existing messages (for seen status, isDeleted, body changes, etc.)
          mergedMessages = mergedMessages.map((existingMsg) => {
            const updatedMsg = newMessages.find((m) => m.id === existingMsg.id);
            if (!updatedMsg) return existingMsg;
            
            // Merge seen arrays properly
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
              body: updatedMsg.body ?? existingMsg.body,
              isDeleted: updatedMsg.isDeleted ?? existingMsg.isDeleted,
              replyTo: updatedMsg.replyTo || existingMsg.replyTo,
              reactions: updatedMsg.reactions || existingMsg.reactions || [],
              seen: mergedSeen,
              seenIds: updatedMsg.seenIds || existingMsg.seenIds || [],
            };
          });
          
          // Sort messages by createdAt to ensure correct order
          mergedMessages.sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return aTime - bTime;
          });
        }

        // Parse lastMessageAt to ensure it's a valid Date
        const newLastMessageAt = conversation.lastMessageAt 
          ? new Date(conversation.lastMessageAt)
          : existingConversation.lastMessageAt;

        const updatedConversation = {
          ...existingConversation,
          name: conversation.name ?? existingConversation.name,
          image: conversation.image ?? existingConversation.image,
          users: conversation.users && conversation.users.length > 0 
            ? conversation.users 
            : existingConversation.users,
          isGroup: conversation.isGroup ?? existingConversation.isGroup,
          lastMessageAt: newLastMessageAt,
          messages: mergedMessages,
        };

        console.log('[ConversationList] Updated conversation, messages count:', mergedMessages.length);

        // Create new array with updated conversation at the top (most recent)
        const newItems = current.filter(c => c.id !== conversation.id);
        
        // Sort by lastMessageAt (most recent first)
        return [updatedConversation, ...newItems].sort((a, b) => {
          const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
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
      
      // Check seenIds first (more reliable)
      const seenIds = (lastMessage as any).seenIds || [];
      if (userId && seenIds.includes(userId)) {
        return total;
      }
      
      // Fallback to seen array
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
            items.map((item) => {
              // Create a unique key that changes when messages update
              const lastMsg = item.messages?.[item.messages.length - 1];
              const uniqueKey = `${item.id}-${lastMsg?.id || 'no-msg'}-${item.lastMessageAt}`;
              
              return (
                <MemoizedConversationBox
                  key={uniqueKey}
                  data={item}
                  selected={conversationId === item.id}
                />
              );
            })
          )}
        </div>
      </aside>
    </>
  );
};

export default memo(ConversationList);
