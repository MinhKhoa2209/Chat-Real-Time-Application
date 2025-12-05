"use client";

import { FullMessageType } from "@/app/types";
import clsx from "clsx";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import Avatar from "@/app/components/Avatar";
import Image from "next/image";
import { useState, useMemo, useEffect } from "react";
import axios from "axios";
import {
  FloatingPortal,
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
} from "@floating-ui/react";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { HiOutlineArrowDownTray, HiFaceSmile } from "react-icons/hi2";
import ImageModal from "./ImageModal";
import ForwardModal from "./ForwardModal";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface MessageBoxProps {
  data: FullMessageType;
  isLast?: boolean;
  setReplyTo: (message: FullMessageType) => void;
}

const MessageBox: React.FC<MessageBoxProps> = ({
  data,
  isLast,
  setReplyTo,
}) => {
  const session = useSession();
  const router = useRouter();
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(data.body || "");
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [conversations, setConversations] = useState([]);

  // Fetch conversations when forward modal opens
  useEffect(() => {
    if (isForwardModalOpen && conversations.length === 0) {
      axios.get("/api/conversations")
        .then((res) => setConversations(res.data))
        .catch((err) => console.error("Failed to fetch conversations:", err));
    }
  }, [isForwardModalOpen, conversations.length]);

  const isOwn = session.data?.user?.email === data.sender?.email;
  const reactionList = data.reactions ?? [];
  
  const seenList = useMemo(() => {
    return (data.seen || [])
      .filter((user) => user.email !== data.sender?.email)
      .map((user) => user.name)
      .join(", ");
  }, [data.seen, data.sender?.email]);

  const isFileMessage = Boolean(data.fileUrl && !data.image);
  const isLikeMessage = data.body === "👍" && !data.image && !data.fileUrl;
  
  // Check if message is a system message (user left/joined/added group)
  const isSystemMessage = useMemo(() => {
    if (!data.body) return false;
    return data.body.includes("left the group") || 
           data.body.includes("joined the group") ||
           data.body.includes("added") && data.body.includes("to the group");
  }, [data.body]);
  
  // Check if message is a sticker (single emoji)
  const isStickerMessage = useMemo(() => {
    if (!data.body || data.image || data.fileUrl || data.body === "👍") return false;
    // Check if it's a single emoji (1-2 characters for some emojis)
    const trimmed = data.body.trim();
    return trimmed.length <= 2 && /\p{Emoji}/u.test(trimmed);
  }, [data.body, data.image, data.fileUrl]);
  
  // Check if file is a video
  const isVideoFile = useMemo(() => {
    if (!data.fileUrl) return false;
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv'];
    return videoExtensions.some(ext => data.fileUrl?.toLowerCase().includes(ext));
  }, [data.fileUrl]);

  const container = clsx("flex gap-2 p-4", isOwn && "justify-end");
  const avatar = clsx(isOwn && "order-2");
  const body = clsx("flex flex-col gap-2", isOwn ? "items-end" : "items-start");

  const message = clsx(
    "text-sm w-fit overflow-hidden",
    isLikeMessage
      ? "" // Không có background cho Like
      : data.isDeleted
      ? "italic text-gray-500 bg-gray-100 border border-gray-200"
      : data.image
      ? ""
      : isFileMessage
      ? isOwn
        ? "bg-sky-500 text-white"
        : "bg-white border border-gray-200 text-gray-900"
      : isOwn
      ? "bg-sky-500 text-white"
      : "bg-gray-100",
    isLikeMessage
      ? "" // Không có padding/border cho Like
      : data.image
      ? "rounded-md p-0"
      : isFileMessage
      ? "rounded-xl px-4 py-3"
      : "rounded-full py-2 px-3"
  );

  const replyPreview = useMemo(() => {
    if (!data.replyTo) return null;
    
    // Debug log
    if (data.id === "693010c328378dcfd25c40a6") {
      console.log("Reply data for message 693010c328378dcfd25c40a6:", {
        hasReplyTo: !!data.replyTo,
        replyToId: data.replyTo?.id,
        hasSender: !!data.replyTo?.sender,
        senderName: data.replyTo?.sender?.name,
      });
    }
    
    if (data.replyTo.image) return "Sent an image";
    if (data.replyTo.fileUrl) return "Sent a file";
    return data.replyTo.body || "Message";
  }, [data.replyTo, data.id]);

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return null;
    const units = ["KB", "MB", "GB"];
    let size = bytes / 1024;
    let i = 0;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(1)} ${units[i]}`;
  };

  const handleReact = (emoji: string) => {
    axios.post(`/api/messages/${data.id}/react`, { content: emoji });
  };

  const handleUnsend = () => {
    toast((t) => (
      <div className="flex flex-col gap-2">
        <span>Unsend this message?</span>
        <div className="flex gap-2">
          <button
            onClick={() => {
              toast.dismiss(t.id);
              axios.delete(`/api/messages/${data.id}`)
                .then(() => toast.success("Message unsent"))
                .catch(() => toast.error("Failed to unsend"));
            }}
            className="px-3 py-1 bg-red-500 text-white rounded text-sm"
          >
            Unsend
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1 bg-gray-200 rounded text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  const handleReply = () => {
    setReplyTo(data);
  };

  const handleEdit = () => {
    if (data.image || data.fileUrl) {
      toast.error("Cannot edit messages with images or files");
      return;
    }
    setIsEditing(true);
    setEditedText(data.body || "");
  };

  const handleSaveEdit = () => {
    if (!editedText.trim()) {
      toast.error("Message cannot be empty");
      return;
    }

    axios.put(`/api/messages/${data.id}`, { body: editedText })
      .then(() => {
        setIsEditing(false);
        toast.success("Message edited");
      })
      .catch((error) => {
        console.error("Edit error:", error);
        toast.error("Failed to edit message");
      });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedText(data.body || "");
  };

  const handleForward = () => {
    setIsForwardModalOpen(true);
  };

  const handleRemove = () => {
    toast((t) => (
      <div className="flex flex-col gap-2">
        <span>Remove from your view?</span>
        <div className="flex gap-2">
          <button
            onClick={() => {
              toast.dismiss(t.id);
              axios.post(`/api/messages/${data.id}/hide`)
                .then(() => toast.success("Message removed"))
                .catch(() => toast.error("Failed to remove"));
            }}
            className="px-3 py-1 bg-red-500 text-white rounded text-sm"
          >
            Remove
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1 bg-gray-200 rounded text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  // Get personalized system message text
  const systemMessageText = useMemo(() => {
    if (!data.body) return "";
    const body = data.body;
    
    // Check if this is an "added to group" message
    if (body.includes(" added ") && body.includes(" to the group")) {
      const userEmail = session.data?.user?.email;
      const userName = session.data?.user?.name;
      const addedMemberEmails = (data as any).addedMemberEmails || [];
      
      // Check if current user was added
      if (userEmail && addedMemberEmails.includes(userEmail)) {
        const senderName = data.sender?.name || "Someone";
        return `${senderName} added you to the group`;
      }
      
      // Fallback: check if user's name is in the message
      if (userName && body.includes(` added ${userName}`)) {
        const senderName = data.sender?.name || "Someone";
        return `${senderName} added you to the group`;
      }
    }
    
    return body;
  }, [data, session.data?.user?.email, session.data?.user?.name]);

  // Render system message (user left/joined/added group) - Messenger style
  if (isSystemMessage) {
    return (
      <div className="flex items-center gap-2 p-2 justify-center">
        <Avatar user={data.sender} />
        <div className="text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full font-medium">
          {systemMessageText}
        </div>
      </div>
    );
  }

  return (
    <>
      <ForwardModal
        isOpen={isForwardModalOpen}
        onClose={() => setIsForwardModalOpen(false)}
        message={data}
        conversations={conversations}
      />
      
      <div className={container}>
        <div className={avatar}>
          <Avatar user={data.sender} />
        </div>

      <div className={body}>
        <div className="flex items-center gap-1">
          <div className="text-sm text-gray-500">{data.sender.name}</div>
          <div className="text-xs text-gray-400">
            {format(new Date(data.createdAt), "p")}
          </div>
        </div>

        {data.forwardedFrom && !data.isDeleted && (
          <div className="text-xs text-gray-600 mb-2 flex items-center gap-1.5 font-medium">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span>Forwarded from {data.forwardedFrom.name}</span>
          </div>
        )}

        {data.replyTo && !data.isDeleted && (
          <div className="text-xs text-gray-500 bg-gray-50 border-l-2 border-sky-500 pl-2 py-1 mb-1 max-w-60 truncate opacity-80">
            <span className="font-bold mr-1">
              {data.replyTo.sender?.name || "Unknown"}:
            </span>
            {replyPreview}
          </div>
        )}

        <div className="relative group flex items-center gap-2">
          {isOwn && !data.isDeleted && (
            <MessageActionsMenu
              isOwn={isOwn}
              onReply={handleReply}
              onUnsend={handleUnsend}
              onReact={handleReact}
              onEdit={handleEdit}
              onForward={handleForward}
            />
          )}

          <div className={message}>
            <ImageModal
              src={data.image}
              isOpen={imageModalOpen}
              onClose={() => setImageModalOpen(false)}
            />

            {data.isDeleted ? (
              <div>{data.body}</div>
            ) : isLikeMessage ? (
              <div className="text-6xl cursor-pointer hover:scale-110 transition">
                👍
              </div>
            ) : isStickerMessage ? (
              <div className="text-4xl cursor-pointer hover:scale-110 transition">
                {data.body}
              </div>
            ) : data.image ? (
              data.image.includes('giphy.com') || data.image.endsWith('.gif') ? (
                // Use regular img tag for GIFs to avoid Next.js Image optimization issues
                <img
                  alt="GIF"
                  src={data.image}
                  onClick={() => setImageModalOpen(true)}
                  className="max-w-[288px] max-h-[288px] object-cover cursor-pointer hover:scale-110 transition rounded-md"
                />
              ) : (
                <Image
                  alt="Image"
                  height="288"
                  width="288"
                  src={data.image}
                  onClick={() => setImageModalOpen(true)}
                  className="object-cover cursor-pointer hover:scale-110 transition translate rounded-md"
                />
              )
            ) : isFileMessage ? (
              isVideoFile ? (
                <video
                  controls
                  className="max-w-[288px] max-h-[288px] rounded-md"
                  src={data.fileUrl || undefined}
                >
                  Trình duyệt không hỗ trợ video.
                </video>
              ) : (
                <a
                  href={data.fileUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={clsx(
                    "flex items-center gap-3 no-underline",
                    isOwn ? "text-white" : "text-gray-900"
                  )}
                  download={data.fileName || undefined}
                >
                  <div
                    className={clsx(
                      "p-3 rounded-full",
                      isOwn ? "bg-white/20" : "bg-sky-100 text-sky-600"
                    )}
                  >
                    <HiOutlineArrowDownTray size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm max-w-[200px] truncate">
                      {data.fileName || "Attachment"}
                    </span>
                    {formatFileSize(data.fileSize) && (
                      <span className="text-xs opacity-75">
                        {formatFileSize(data.fileSize)}
                      </span>
                    )}
                  </div>
                </a>
              )
            ) : isEditing ? (
              <div className="flex flex-col gap-2 min-w-[200px] max-w-[350px]">
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className={clsx(
                    "w-full p-2 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm",
                    isOwn 
                      ? "bg-white text-gray-900 border-2 border-sky-400" 
                      : "bg-white text-gray-900 border-2 border-gray-300"
                  )}
                  rows={2}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveEdit();
                    }
                    if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1 text-xs font-medium bg-sky-500 hover:bg-sky-600 text-white rounded-md transition"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div>{data.body}</div>
            )}
          </div>

          {!isOwn && !data.isDeleted && (
            <MessageActionsMenu
              isOwn={isOwn}
              onReply={handleReply}
              onReact={handleReact}
              onForward={handleForward}
              onRemove={handleRemove}
            />
          )}
        </div>

        {reactionList.length > 0 && !data.isDeleted && (
          <div
            className={clsx(
              "inline-flex items-center -mt-2 bg-white rounded-full px-1 py-0 shadow-sm border border-gray-100 text-xs h-5",
              isOwn ? "mr-1" : "ml-1"
            )}
          >
            {reactionList.slice(0, 3).map((r, i) => (
              <span key={i} title={r.user.name}>
                {r.content}
              </span>
            ))}
            {reactionList.length > 3 && (
              <span className="text-gray-400 ml-0.5">
                +{reactionList.length - 3}
              </span>
            )}
          </div>
        )}

        {isLast && isOwn && seenList.length > 0 && (
          <div className="text-xs font-light text-gray-500">
            {`Seen by ${seenList}`}
          </div>
        )}
      </div>
    </div>
    </>
  );
};

/* ------------------------------------------------------
   MessageActionsMenu: UPDATED (Modern Headless UI)
------------------------------------------------------- */

const MessageActionsMenu = ({ isOwn, onReply, onUnsend, onReact, onEdit, onForward, onRemove }: any) => {
  const { refs, floatingStyles, update } = useFloating({
    placement: isOwn ? "top-end" : "top-start",
    middleware: [offset(6), flip(), shift()],
  });

  useEffect(() => {
    if (refs.reference.current && refs.floating.current) {
      return autoUpdate(refs.reference.current, refs.floating.current, update);
    }
  }, [refs.reference, refs.floating, update]);

  return (
    <Menu
      as="div"
      className="relative inline-block text-left opacity-0 group-hover:opacity-100 transition-opacity z-50"
    >
      <MenuButton
        ref={refs.setReference}
        className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition outline-none"
      >
        <HiFaceSmile className="w-5 h-5" />
      </MenuButton>

      <FloatingPortal>
        <MenuItems
          ref={refs.setFloating}
          style={floatingStyles}
          className="w-fit divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
        >
          <div className="px-2 py-2 flex gap-1 justify-center bg-gray-50 rounded-t-md">
            {["❤️", "😆", "😮", "👍", "👎", "😡"].map((emoji) => (
              <MenuItem key={emoji} as="div">
                <button
                  onClick={() => onReact(emoji)}
                  className="hover:scale-125 transition text-lg px-1 cursor-pointer"
                >
                  {emoji}
                </button>
              </MenuItem>
            ))}
          </div>

          <div className="p-1">
            <MenuItem>
              {({ focus }) => (
                <button
                  onClick={onReply}
                  className={`${
                    focus ? "bg-sky-500 text-white" : "text-gray-900"
                  } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                >
                  Reply
                </button>
              )}
            </MenuItem>

            <MenuItem>
              {({ focus }) => (
                <button
                  onClick={onForward}
                  className={`${
                    focus ? "bg-sky-500 text-white" : "text-gray-900"
                  } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                >
                  Forward
                </button>
              )}
            </MenuItem>

            {isOwn && onEdit && (
              <MenuItem>
                {({ focus }) => (
                  <button
                    onClick={onEdit}
                    className={`${
                      focus ? "bg-sky-500 text-white" : "text-gray-900"
                    } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                  >
                    Edit
                  </button>
                )}
              </MenuItem>
            )}

            {isOwn && onUnsend && (
              <MenuItem>
                {({ focus }) => (
                  <button
                    onClick={onUnsend}
                    className={`${
                      focus ? "bg-red-500 text-white" : "text-red-900"
                    } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                  >
                    Unsend
                  </button>
                )}
              </MenuItem>
            )}

            {!isOwn && onRemove && (
              <MenuItem>
                {({ focus }) => (
                  <button
                    onClick={onRemove}
                    className={`${
                      focus ? "bg-red-500 text-white" : "text-red-900"
                    } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                  >
                    Remove
                  </button>
                )}
              </MenuItem>
            )}
          </div>
        </MenuItems>
      </FloatingPortal>
    </Menu>
  );
};

export default MessageBox;