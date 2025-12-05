"use client";

import Modal from "@/app/components/Modal";
import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

interface StickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
}

// Popular sticker emojis
const STICKERS = [
  "👍", "👎", "❤️", "😂", "😮", "😢", "😡", "🎉",
  "🔥", "⭐", "✨", "💯", "🙏", "👏", "💪", "🤝",
  "🎊", "🎈", "🎁", "🌟", "💝", "💖", "💕", "💗",
  "😍", "🥰", "😘", "😊", "😁", "😎", "🤗", "🤩",
  "😴", "😪", "🥱", "😌", "😇", "🤔", "🤨", "😏",
  "😬", "🙄", "😑", "😐", "😶", "🤐", "😯", "😦",
  "🤯", "😱", "😨", "😰", "😥", "😓", "🤗", "🤭",
  "🤫", "🤥", "😶‍🌫️", "😵", "😵‍💫", "🤢", "🤮", "🤧",
  "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹",
  "👺", "🤡", "💩", "👻", "💀", "☠️", "👽", "👾",
];

const StickerModal: React.FC<StickerModalProps> = ({
  isOpen,
  onClose,
  conversationId,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleStickerClick = async (sticker: string) => {
    setIsLoading(true);

    try {
      await axios.post("/api/messages", {
        message: sticker,
        conversationId,
      });

      onClose();
      toast.success("Sticker sent!");
    } catch (error) {
      console.error("Sticker send error:", error);
      toast.error("Failed to send sticker");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Choose a Sticker
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Click on a sticker to send it
          </p>
        </div>

        {/* Sticker Grid */}
        <div className="grid grid-cols-8 gap-2 max-h-[400px] overflow-y-auto p-2">
          {STICKERS.map((sticker, index) => (
            <button
              key={index}
              onClick={() => handleStickerClick(sticker)}
              disabled={isLoading}
              className="text-4xl hover:scale-125 transition-transform duration-200 p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title={sticker}
            >
              {sticker}
            </button>
          ))}
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default StickerModal;
