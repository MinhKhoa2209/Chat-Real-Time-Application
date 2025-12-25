"use client";

import useConversation from "@/app/hooks/useConversation";
import { FullConversationType } from "@/app/types";
import { MdOutlineGroupAdd } from "react-icons/md";
import { HiMagnifyingGlass, HiXMark } from "react-icons/hi2";
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

const MemoizedConversationBox = memo(ConversationBox, (prevProps, nextProps) => {
  if (prevProps.selected !== nextProps.selected) return false;
  if (prevProps.data.id !== nextProps.data.id) return false;
  
  const prevTime = prevProps.data.lastMessageAt ? new Date(prevProps.data.lastMessageAt).getTime() : 0;
  const nextTime = nextProps.data.lastMessageAt ? new Date(nextProps.data.lastMessageAt).getTime() : 0;
  if (prevTime !== nextTime) return false;
  
  const prevMsgLen = prevProps.data.messages?.length || 0;
  const nextMsgLen = nextProps.data.messages?.length || 0;
  if (prevMsgLen !== nextMsgLen) return false;
  
  const prevLastMsgId = prevProps.data.messages?.[prevMsgLen - 1]?.id;
  const nextLastMsgId = nextProps.data.messages?.[nextMsgLen - 1]?.id;
  if (prevLastMsgId !== nextLastMsgId) return false;
  
  const prevLastMsgBody = prevProps.data.messages?.[prevMsgLen - 1]?.body;
  const nextLastMsgBody = nextProps.data.messages?.[nextMsgLen - 1]?.body;
  if (prevLastMsgBody !== nextLastMsgBody) return false;
  
  const prevLastMsgDeleted = prevProps.data.messages?.[prevMsgLen - 1]?.isDeleted;
  const nextLastMsgDeleted = nextProps.data.messages?.[nextMsgLen - 1]?.isDeleted;
  if (prevLastMsgDeleted !== nextLastMsgDeleted) return false;
  
  if (prevProps.data.name !== nextProps.data.name) return false;
  if (prevProps.data.image !== nextProps.data.image) return false;
  
  const prevUsers = prevProps.data.users || [];
  const nextUsers = nextProps.data.users || [];
  if (prevUsers.length !== nextUsers.length) return false;
  for (let i = 0; i < prevUsers.length; i++) {
    const prevUser = prevUsers[i];
    const nextUser = nextUsers.find((u: any) => u.id === prevUser.id);
    if (!nextUser) return false;
    if (prevUser.image !== nextUser.image || prevUser.name !== nextUser.name) return false;
  }
  
  return true;
});

const ConversationList: React.FC<ConversationListProps> = ({ initialItems, users }) => {
  const { data: sessionData } = useSession();
  const [items, setItems] = useState(initialItems || []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const router = useRouter();
  const { conversationId, isOpen } = useConversation();

  const pusherKey = useMemo(() => sessionData?.user?.email, [sessionData?.user?.email]);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);
  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => !prev);
    if (isSearchOpen) setSearchTerm("");
  }, [isSearchOpen]);
  const clearSearch = useCallback(() => setSearchTerm(""), []);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const lowerSearch = searchTerm.toLowerCase().trim();
    return items.filter((conversation) => {
      if (conversation.name?.toLowerCase().includes(lowerSearch)) return true;
      const userNames = conversation.users?.map((user: any) => user.name?.toLowerCase() || "").join(" ");
      if (userNames?.includes(lowerSearch)) return true;
      const lastMessage = conversation.messages?.[conversation.messages.length - 1];
      if (lastMessage?.body?.toLowerCase().includes(lowerSearch)) return true;
      return false;
    });
  }, [items, searchTerm]);

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

    const updateHandler = (conversation: FullConversationType & { imageUpdated?: boolean }) => {
      setItems((current) => {
        const existingIndex = current.findIndex(c => c.id === conversation.id);
        if (existingIndex === -1) {
          if (!conversation.users || conversation.users.length === 0) return current;
          return [conversation, ...current];
        }

        const existingConversation = current[existingIndex];
        const currentMessages = existingConversation.messages || [];
        const newMessages = conversation.messages || [];
        let mergedMessages = [...currentMessages];
        
        if (newMessages.length > 0) {
          const existingMessageIds = new Set(currentMessages.map((m) => m.id));
          const messagesToAdd = newMessages.filter((m) => !existingMessageIds.has(m.id));
          if (messagesToAdd.length > 0) mergedMessages = [...mergedMessages, ...messagesToAdd];
          
          mergedMessages = mergedMessages.map((existingMsg) => {
            const updatedMsg = newMessages.find((m) => m.id === existingMsg.id);
            if (!updatedMsg) return existingMsg;
            const existingSeen = existingMsg.seen || [];
            const newSeen = updatedMsg.seen || [];
            const seenMap = new Map();
            [...existingSeen, ...newSeen].forEach((user: any) => {
              if (user?.id) seenMap.set(user.id, user);
            });
            return {
              ...existingMsg, ...updatedMsg,
              body: updatedMsg.body ?? existingMsg.body,
              isDeleted: updatedMsg.isDeleted ?? existingMsg.isDeleted,
              replyTo: updatedMsg.replyTo || existingMsg.replyTo,
              reactions: updatedMsg.reactions || existingMsg.reactions || [],
              seen: Array.from(seenMap.values()),
              seenIds: updatedMsg.seenIds || existingMsg.seenIds || [],
            };
          });
          mergedMessages.sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return aTime - bTime;
          });
        }

        const updatedConversation = {
          ...existingConversation,
          name: conversation.name ?? existingConversation.name,
          image: conversation.image ?? existingConversation.image,
          users: conversation.users?.length > 0 ? conversation.users : existingConversation.users,
          isGroup: conversation.isGroup ?? existingConversation.isGroup,
          lastMessageAt: conversation.lastMessageAt ? new Date(conversation.lastMessageAt) : existingConversation.lastMessageAt,
          messages: mergedMessages,
        };

        const newItems = current.filter(c => c.id !== conversation.id);
        return [updatedConversation, ...newItems].sort((a, b) => {
          const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bTime - aTime;
        });
      });
    };

    const removeHandler = (conversation: FullConversationType) => {
      setItems((current) => current.filter((convo) => convo.id !== conversation.id));
      if (conversationId === conversation.id) router.push("/conversations");
    };

    const userUpdateHandler = (updatedUser: { id: string; name?: string; image?: string }) => {
      setItems((current) => 
        current.map((conversation) => ({
          ...conversation,
          users: conversation.users.map((user: any) => 
            user.id === updatedUser.id 
              ? { ...user, name: updatedUser.name ?? user.name, image: updatedUser.image ?? user.image }
              : user
          ),
        }))
      );
    };

    channel.bind("conversation:new", newHandler);
    channel.bind("conversation:update", updateHandler);
    channel.bind("conversation:remove", removeHandler);
    channel.bind("user:update", userUpdateHandler);

    return () => {
      channel.unbind("conversation:new", newHandler);
      channel.unbind("conversation:update", updateHandler);
      channel.unbind("conversation:remove", removeHandler);
      channel.unbind("user:update", userUpdateHandler);
    };
  }, [pusherKey, conversationId, router]);

  const totalUnreadCount = useMemo(() => {
    const userEmail = sessionData?.user?.email;
    const userId = (sessionData?.user as any)?.id;
    if (!userEmail) return 0;

    return items.reduce((total, conversation) => {
      const messages = conversation.messages || [];
      let lastMessage = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i] as any;
        if (!(msg.hiddenForIds || []).includes(userId)) { lastMessage = msg; break; }
      }
      if (!lastMessage || lastMessage.sender?.email === userEmail) return total;
      const seenIds = (lastMessage as any).seenIds || [];
      if (userId && seenIds.includes(userId)) return total;
      const hasSeenByUser = (lastMessage.seen || []).some((user: any) => user.email === userEmail);
      return hasSeenByUser ? total : total + 1;
    }, 0);
  }, [items, sessionData?.user]);


  return (
    <>
      <GroupChatModal users={users} isOpen={isModalOpen} onClose={closeModal} />
      <aside className={clsx(
        "fixed inset-y-0 pb-20 lg:pb-0 lg:left-20 lg:w-80 lg:block overflow-y-auto border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900",
        isOpen ? "hidden" : "block w-full left-0"
      )}>
        <div className="px-4">
          {/* Header */}
          <div className="sticky top-0 z-10 pt-6 pb-4 bg-white dark:bg-gray-900">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold gradient-text">Messages</h1>
                {totalUnreadCount > 0 && (
                  <div className="unread-badge text-white text-xs font-bold rounded-full h-6 min-w-6 px-2 flex items-center justify-center">
                    {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSearch}
                  className={clsx(
                    "rounded-xl p-2.5 cursor-pointer transition-all duration-300",
                    isSearchOpen 
                      ? "gradient-primary text-white shadow-lg" 
                      : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-700"
                  )}
                  aria-label="Search conversations"
                >
                  <HiMagnifyingGlass size={20} />
                </button>
                <button
                  onClick={openModal}
                  className="fab rounded-xl p-2.5 text-white cursor-pointer"
                  aria-label="Create group chat"
                >
                  <MdOutlineGroupAdd size={20} />
                </button>
              </div>
            </div>
            
            {/* Search Input */}
            <div className={clsx(
              "overflow-hidden transition-all duration-300 ease-out",
              isSearchOpen ? "max-h-16 opacity-100 mb-2" : "max-h-0 opacity-0"
            )}>
              <div className="search-modern relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <HiMagnifyingGlass className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full pl-12 pr-12 py-3 bg-transparent border-0 text-sm focus:outline-none placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white"
                  autoFocus={isSearchOpen}
                />
                {searchTerm && (
                  <button onClick={clearSearch} className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
                    <HiXMark className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Conversation List */}
          <div className="space-y-2 pb-4">
            {filteredItems.length === 0 ? (
              <div className="text-center py-16 px-4 animate-fade-in">
                {searchTerm ? (
                  <>
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <HiMagnifyingGlass className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No results found</p>
                    <p className="text-xs mt-1 text-gray-400 dark:text-gray-500">Try a different search term</p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl gradient-primary opacity-20 flex items-center justify-center">
                      <svg className="w-10 h-10 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No conversations yet</p>
                    <p className="text-xs mt-1 text-gray-400 dark:text-gray-500">Click the + button to start chatting</p>
                  </>
                )}
              </div>
            ) : (
              filteredItems.map((item) => {
                const lastMsg = item.messages?.[item.messages.length - 1];
                return (
                  <MemoizedConversationBox
                    key={`${item.id}-${lastMsg?.id || 'no-msg'}-${item.lastMessageAt}`}
                    data={item}
                    selected={conversationId === item.id}
                  />
                );
              })
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default memo(ConversationList);