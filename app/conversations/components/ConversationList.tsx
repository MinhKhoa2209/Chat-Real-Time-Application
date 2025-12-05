"use client";
import useConversation from "@/app/hooks/useConversation";
import { FullConversationType } from "@/app/types";
import { MdOutlineGroupAdd } from "react-icons/md";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ConversationBox from "./ConversationBox";
import GroupChatModal from "./GroupChatModal";
import { pusherClient } from "@/app/libs/pusher";
import { useSession } from "next-auth/react";
import { find } from "lodash";

interface ConversationListProps {
  initialItems: FullConversationType[];
  users: any[]; 
}
const ConversationList: React.FC<ConversationListProps> = ({
  initialItems,
  users,
}) => {
  const session = useSession();
  const [items, setItems] = useState(initialItems || []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();
  const { conversationId, isOpen } = useConversation();
  const pusherKey = useMemo(() => {
    const email = session.data?.user?.email;
    console.log("👤 Current user email for Pusher:", email);
    return email;
  }, [session.data?.user?.email]);

  useEffect(() => {
    if (!pusherKey) {
      console.log("❌ No pusher key, skipping subscription");
      return;
    }

    console.log("📡 Subscribing to Pusher channel:", pusherKey);
    const channel = pusherClient.subscribe(pusherKey);
    
    channel.bind('pusher:subscription_succeeded', () => {
      console.log("✅ Successfully subscribed to channel:", pusherKey);
    });
    
    channel.bind('pusher:subscription_error', (error: any) => {
      console.error("❌ Subscription error:", error);
    });

    const newHandler = (conversation: FullConversationType) => {
      console.log("🆕 Received conversation:new event:", {
        id: conversation.id,
        name: conversation.name,
        userCount: conversation.users?.length,
        messagesCount: conversation.messages?.length,
        lastMessage: conversation.messages?.[0],
        addedMemberEmails: (conversation.messages?.[0] as any)?.addedMemberEmails,
      });
      setItems((current) => {
        // Check if conversation already exists
        const existing = find(current, { id: conversation.id });
        if (existing) {
          console.log("Conversation already exists, updating instead");
          // Update existing conversation (this handles restore case)
          return current.map((item) =>
            item.id === conversation.id ? { ...conversation, messages: conversation.messages || item.messages } : item
          );
        }

        console.log("Adding new conversation to list with addedMemberEmails");
        return [conversation, ...current];
      });
    };
    const updateHandler = async (conversation: any) => {
      console.log("=== CONVERSATION UPDATE EVENT ===");
      console.log("Received conversation:update event:", {
        conversationId: conversation.id,
        hasUsers: !!conversation.users,
        usersCount: conversation.users?.length,
        hasMessages: !!conversation.messages,
        messageCount: conversation.messages?.length,
        name: conversation.name,
        image: conversation.image ? "has image" : "no image",
        imageUpdated: conversation.imageUpdated,
      });
      console.log("=================================");
      
      // If imageUpdated flag is set, we need to refetch to get the actual image
      if (conversation.imageUpdated && conversation.id) {
        console.log("Image was updated, refetching conversation...");
        try {
          const response = await fetch(`/api/conversations/${conversation.id}`);
          if (response.ok) {
            const freshData = await response.json();
            conversation = { ...conversation, image: freshData.image };
          }
        } catch (error) {
          console.error("Failed to refetch conversation image:", error);
        }
      }
      
      setItems((current) => {
        console.log("Current conversations count:", current.length);
        console.log("Current conversation IDs:", current.map(c => c.id));
        console.log("Looking for conversation ID:", conversation.id);
        
        const updated = current.map((currentConversation) => {
          if (currentConversation.id === conversation.id) {
            console.log("✅ MATCH! Updating conversation:", conversation.id);
            // Ensure messages arrays exist
            const currentMessages = currentConversation.messages || [];
            const newConversationMessages = conversation.messages || [];
            
            // Always update name, image, users if provided
            const baseUpdate = {
              ...currentConversation,
              name: conversation.name ?? currentConversation.name,
              image: conversation.image ?? currentConversation.image,
              users: conversation.users || currentConversation.users,
              isGroup: conversation.isGroup ?? currentConversation.isGroup,
              lastMessageAt: conversation.lastMessageAt || currentConversation.lastMessageAt,
            };
            
            // If update has no messages, keep current messages
            if (newConversationMessages.length === 0) {
              console.log("No new messages, keeping current messages");
              return baseUpdate;
            }
            
            const existingMessageIds = new Set(currentMessages.map((m: any) => m.id));
            const newMessages = newConversationMessages.filter((m: any) => !existingMessageIds.has(m.id));
            const updatedMessages = currentMessages.map((existingMsg: any) => {
              const updatedMsg = newConversationMessages.find((m: any) => m.id === existingMsg.id);
              if (updatedMsg) {
                return {
                  ...existingMsg,
                  ...updatedMsg,
                  replyTo: updatedMsg.replyTo || existingMsg.replyTo,
                  reactions: updatedMsg.reactions || existingMsg.reactions || [],
                  seen: updatedMsg.seen && updatedMsg.seen.length > 0 
                    ? updatedMsg.seen 
                    : existingMsg.seen || [],
                };
              }
              return existingMsg;
            });
            
            const updatedConv = {
              ...baseUpdate,
              messages: [...updatedMessages, ...newMessages],
            };
            console.log("Updated conversation - name:", updatedConv.name, "users:", updatedConv.users?.length);
            return updatedConv;
          }

          return currentConversation;
        });

        // Check if conversation was found and updated
        const wasUpdated = updated.some((c) => c.id === conversation.id);
        console.log("Conversation was updated:", wasUpdated);

        // If conversation not found in list, add it (user was just added to this conversation)
        if (!wasUpdated) {
          console.log("⚠️ Conversation not found in list! Adding it now...");
          // User was just added to this conversation, add it to the list
          return [conversation, ...updated];
        }

        // Sort by last message time
        return updated.sort((a, b) => {
          const aMessages = a.messages || [];
          const bMessages = b.messages || [];
          const aLastMessage = aMessages[aMessages.length - 1];
          const bLastMessage = bMessages[bMessages.length - 1];
          
          const aTime = aLastMessage?.createdAt 
            ? new Date(aLastMessage.createdAt).getTime() 
            : 0;
          const bTime = bLastMessage?.createdAt 
            ? new Date(bLastMessage.createdAt).getTime() 
            : 0;
          
          return bTime - aTime; 
        });
      });
    };
    const removeHandler = (conversation: FullConversationType) => {
      console.log("Received conversation:remove event:", conversation);
      setItems((current) => {
        const filtered = current.filter((convo) => convo.id !== conversation.id);
        console.log("Filtered conversations:", {
          before: current.length,
          after: filtered.length,
          removedId: conversation.id,
        });
        return filtered;
      });
      
      // If currently viewing the deleted conversation, redirect
      if (conversationId === conversation.id) {
        console.log("Redirecting to /conversations");
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
      pusherClient.unsubscribe(pusherKey);
    };
  }, [pusherKey, conversationId, router]);
  // Calculate total unread messages
  const totalUnreadCount = useMemo(() => {
    if (!session.data?.user?.email) return 0;

    return items.reduce((total, conversation) => {
      const messages = conversation.messages || [];
      const unread = messages.filter((message: any) => {
        const seenArray = message.seen || [];
        const hasSeenByUser = seenArray.some(
          (user: any) => user.email === session.data?.user?.email
        );
        const isOwnMessage = message.sender?.email === session.data?.user?.email;
        return !isOwnMessage && !hasSeenByUser;
      });
      return total + unread.length;
    }, 0);
  }, [items, session.data?.user?.email]);

  return (
    <>
      <GroupChatModal
        users={users}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
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
            <div
              onClick={() => setIsModalOpen(true)}
              className="rounded-full p-2 bg-gray-100 text-gray-600 cursor-pointer hover:opacity-75 transition"
            >
              <MdOutlineGroupAdd size={20} />
            </div>
          </div>
          {items.length === 0 ? (
            <div className="text-center text-gray-400 py-12 px-4">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="text-xs mt-1">Click the + button to start chatting</p>
            </div>
          ) : (
            items.map((item) => (
              <ConversationBox
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
export default ConversationList;
