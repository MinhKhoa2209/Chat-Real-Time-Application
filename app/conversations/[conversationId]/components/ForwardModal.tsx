"use client";

import Modal from "@/app/components/Modal";
import { FullConversationType, FullMessageType } from "@/app/types";
import { useState } from "react";
import Avatar from "@/app/components/Avatar";
import AvatarGroup from "@/app/components/AvatarGroup";
import { useSession } from "next-auth/react";
import axios from "axios";
import toast from "react-hot-toast";
import clsx from "clsx";

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: FullMessageType;
  conversations: FullConversationType[];
}

const ForwardModal: React.FC<ForwardModalProps> = ({
  isOpen,
  onClose,
  message,
  conversations,
}) => {
  const session = useSession();
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const toggleConversation = (conversationId: string) => {
    setSelectedConversations((prev) =>
      prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId]
    );
  };

  const handleForward = async () => {
    if (selectedConversations.length === 0) {
      toast.error("Please select at least one conversation");
      return;
    }

    setIsLoading(true);

    try {
      const forwardPromises = selectedConversations.map((conversationId) =>
        axios.post("/api/messages", {
          message: message.body,
          image: message.image,
          fileUrl: message.fileUrl,
          fileName: message.fileName,
          fileSize: message.fileSize,
          conversationId,
          forwardedFromId: message.senderId,
        })
      );

      await Promise.all(forwardPromises);
      
      // Close modal and reset state before showing toast
      const count = selectedConversations.length;
      setSelectedConversations([]);
      setIsLoading(false);
      onClose();
      
      // Show toast after cleanup
      toast.success(`Forwarded to ${count} conversation(s)`);
    } catch (error) {
      console.error("Forward error:", error);
      setIsLoading(false);
      toast.error("Failed to forward message");
    }
  };

  const getOtherUser = (conversation: FullConversationType) => {
    const currentUserEmail = session.data?.user?.email;
    return conversation.users.find((user) => user.email !== currentUserEmail);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Forward Message
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Select conversations to forward this message to
          </p>
        </div>

        {/* Message Preview */}
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Message:</p>
          {message.image && (
            <div className="text-sm text-gray-700 mb-1">📷 Image</div>
          )}
          {message.fileUrl && (
            <div className="text-sm text-gray-700 mb-1">
              📎 {message.fileName || "File"}
            </div>
          )}
          {message.body && (
            <p className="text-sm text-gray-900 line-clamp-2">{message.body}</p>
          )}
        </div>

        {/* Conversation List */}
        <div className="max-h-[400px] overflow-y-auto space-y-2">
          {conversations.map((conversation) => {
            const otherUser = getOtherUser(conversation);
            const isSelected = selectedConversations.includes(conversation.id);

            return (
              <div
                key={conversation.id}
                onClick={() => toggleConversation(conversation.id)}
                className={clsx(
                  "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition",
                  isSelected
                    ? "bg-sky-100 border-2 border-sky-500"
                    : "bg-white border-2 border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex-shrink-0">
                  {conversation.isGroup ? (
                    <AvatarGroup users={conversation.users} groupImage={conversation.image} />
                  ) : (
                    <Avatar user={otherUser} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {conversation.name || otherUser?.name}
                  </p>
                </div>
                {isSelected && (
                  <div className="flex-shrink-0">
                    <div className="w-5 h-5 bg-sky-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4 border-t">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleForward}
            disabled={isLoading || selectedConversations.length === 0}
            className="px-4 py-2 text-sm font-medium bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading
              ? "Forwarding..."
              : `Forward${selectedConversations.length > 0 ? ` (${selectedConversations.length})` : ""}`}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ForwardModal;
