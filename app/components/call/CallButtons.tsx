"use client";

import { useCall } from "@/app/context/CallContext";
import { HiPhone, HiVideoCamera } from "react-icons/hi2";
import { User } from "@prisma/client";
import toast from "react-hot-toast";
import { memo, useCallback, useMemo } from "react";

interface CallButtonsProps {
  otherUser?: User;
  users?: User[];
  conversationId: string;
  isGroup?: boolean;
  groupName?: string;
}

const CallButtons = memo<CallButtonsProps>(({
  otherUser,
  users,
  conversationId,
  isGroup = false,
  groupName,
}) => {
  const { startCall, status } = useCall();

  // Memoize participants to prevent recalculation
  const participants = useMemo(() => {
    if (isGroup && users) {
      return users.map((u) => ({
        id: u.id,
        name: u.name || "User",
        image: u.image || undefined,
      }));
    }
    if (otherUser) {
      return [{
        id: otherUser.id,
        name: otherUser.name || "User",
        image: otherUser.image || undefined,
      }];
    }
    return [];
  }, [isGroup, users, otherUser]);

  const handleVoiceCall = useCallback(() => {
    if (status !== "idle") {
      toast.error("You are already in a call");
      return;
    }

    if (participants.length === 0) {
      toast.error("No one to call");
      return;
    }

    startCall(conversationId, participants, "voice", isGroup, groupName);
  }, [status, participants, conversationId, isGroup, groupName, startCall]);

  const handleVideoCall = useCallback(() => {
    if (status !== "idle") {
      toast.error("You are already in a call");
      return;
    }

    if (participants.length === 0) {
      toast.error("No one to call");
      return;
    }

    startCall(conversationId, participants, "video", isGroup, groupName);
  }, [status, participants, conversationId, isGroup, groupName, startCall]);

  // Don't show call buttons for Gemini bot
  if (otherUser?.email === "gemini@messenger.com") {
    return null;
  }

  const isDisabled = status !== "idle";

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleVoiceCall}
        disabled={isDisabled}
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        title={isGroup ? "Group voice call" : "Voice call"}
        aria-label={isGroup ? "Start group voice call" : "Start voice call"}
      >
        <HiPhone className="w-5 h-5 text-sky-500" />
      </button>
      <button
        onClick={handleVideoCall}
        disabled={isDisabled}
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        title={isGroup ? "Group video call" : "Video call"}
        aria-label={isGroup ? "Start group video call" : "Start video call"}
      >
        <HiVideoCamera className="w-5 h-5 text-sky-500" />
      </button>
    </div>
  );
});

CallButtons.displayName = "CallButtons";

export default CallButtons;
