"use client";

import { useCall } from "@/app/context/CallContext";
import { HiPhone, HiVideoCamera } from "react-icons/hi2";
import { User } from "@prisma/client";
import toast from "react-hot-toast";

interface CallButtonsProps {
  otherUser: User;
  conversationId: string;
  isGroup?: boolean;
}

const CallButtons: React.FC<CallButtonsProps> = ({
  otherUser,
  conversationId,
  isGroup,
}) => {
  const { startCall, isInCall, isCalling, isRinging } = useCall();

  const handleVoiceCall = () => {
    if (isGroup) {
      toast.error("Cuộc gọi nhóm chưa được hỗ trợ");
      return;
    }
    if (isInCall || isCalling || isRinging) {
      toast.error("Bạn đang trong cuộc gọi khác");
      return;
    }
    startCall(
      otherUser.id,
      otherUser.name || "User",
      otherUser.image || undefined,
      conversationId,
      "voice"
    );
  };

  const handleVideoCall = () => {
    if (isGroup) {
      toast.error("Cuộc gọi nhóm chưa được hỗ trợ");
      return;
    }
    if (isInCall || isCalling || isRinging) {
      toast.error("Bạn đang trong cuộc gọi khác");
      return;
    }
    startCall(
      otherUser.id,
      otherUser.name || "User",
      otherUser.image || undefined,
      conversationId,
      "video"
    );
  };

  // Don't show call buttons for Gemini bot
  if (otherUser?.email === "gemini@messenger.com") {
    return null;
  }

  console.log("CallButtons rendering for:", otherUser?.name);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleVoiceCall}
        disabled={isInCall || isCalling || isRinging}
        className="p-2 rounded-full hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
        title="Gọi thoại"
      >
        <HiPhone className="w-5 h-5 text-sky-500" />
      </button>
      <button
        onClick={handleVideoCall}
        disabled={isInCall || isCalling || isRinging}
        className="p-2 rounded-full hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
        title="Gọi video"
      >
        <HiVideoCamera className="w-5 h-5 text-sky-500" />
      </button>
    </div>
  );
};

export default CallButtons;
