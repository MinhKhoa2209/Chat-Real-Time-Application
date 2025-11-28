"use client";

import { FullMessageType } from "@/app/types";
import clsx from "clsx";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import Avatar from "@/app/components/Avatar";
import Image from "next/image";
import { useState, useMemo, Fragment } from "react";
import axios from "axios";
import { Menu, Transition, MenuButton, MenuItem } from "@headlessui/react";
import { HiOutlineArrowDownTray, HiFaceSmile } from "react-icons/hi2";
import ImageModal from "./ImageModal";

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
  const [imageModalOpen, setImageModalOpen] = useState(false);

  const isOwn = session.data?.user?.email === data.sender?.email;
  const reactionList = data.reactions ?? [];
  const seenList = (data.seen || [])
    .filter((user) => user.email !== data.sender?.email)
    .map((user) => user.name)
    .join(", ");

  const isFileMessage = Boolean(data.fileUrl && !data.image);

  const container = clsx("flex gap-2 p-4", isOwn && "justify-end");
  const avatar = clsx(isOwn && "order-2");
  const body = clsx("flex flex-col gap-2", isOwn && "items-end");

  const message = clsx(
    "text-sm w-fit overflow-hidden",
    data.isDeleted
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
    data.image
      ? "rounded-md p-0"
      : isFileMessage
      ? "rounded-xl px-4 py-3"
      : "rounded-full py-2 px-3"
  );

  const replyPreview = useMemo(() => {
    if (!data.replyTo) {
      return null;
    }

    if (data.replyTo.image) {
      return "Đã gửi một ảnh";
    }

    if (data.replyTo.fileUrl) {
      return "Đã gửi một tệp";
    }

    return data.replyTo.body || "Tin nhắn";
  }, [data.replyTo]);

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return null;
    const units = ["KB", "MB", "GB"];
    let size = bytes / 1024;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const handleReact = (emoji: string) => {
    axios.post(`/api/messages/${data.id}/react`, { content: emoji });
  };

  const handleUnsend = () => {
    if (confirm("Bạn có chắc muốn thu hồi tin nhắn này?")) {
      axios.delete(`/api/messages/${data.id}`);
    }
  };

  const handleReply = () => {
    setReplyTo(data);
  };

  return (
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

        {data.replyTo && !data.isDeleted && (
          <div className="text-xs text-gray-500 bg-gray-50 border-l-2 border-sky-500 pl-2 py-1 mb-1 max-w-60 truncate opacity-80">
            <span className="font-bold mr-1">{data.replyTo.sender.name}:</span>
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
            ) : data.image ? (
              <Image
                onClick={() => setImageModalOpen(true)}
                alt="Image"
                height="288"
                width="288"
                src={data.image}
                className="object-cover cursor-pointer hover:scale-110 transition translate rounded-md"
              />
            ) : isFileMessage ? (
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
                    {data.fileName || "Tệp đính kèm"}
                  </span>
                  {formatFileSize(data.fileSize) && (
                    <span className="text-xs opacity-75">
                      {formatFileSize(data.fileSize)}
                    </span>
                  )}
                </div>
              </a>
            ) : (
              <div>{data.body}</div>
            )}
          </div>

          {!isOwn && !data.isDeleted && (
            <MessageActionsMenu
              isOwn={isOwn}
              onReply={handleReply}
              onReact={handleReact}
            />
          )}
        </div>

        {reactionList.length > 0 && !data.isDeleted && (
          <div
            className={clsx(
              "inline-flex items-center -mt-2 bg-white rounded-full px-1 py-0 shadow-sm border border-gray-100 z-10 text-xs h-5",
              isOwn ? "mr-1" : "ml-1"
            )}
          >
            {reactionList.slice(0, 3).map((reaction, index) => (
              <span key={index} title={reaction.user.name}>
                {reaction.content}
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
            {`Đã xem bởi ${seenList}`}
          </div>
        )}
      </div>
    </div>
  );
};

const MessageActionsMenu = ({ isOwn, onReply, onUnsend, onReact }: any) => {
  return (
    <Menu
      as="div"
      className="relative inline-block text-left opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <MenuButton className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition">
        <HiFaceSmile className="w-5 h-5" />
      </MenuButton>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <div
          className={clsx(
            "absolute z-50 bottom-full mb-2 w-fit origin-bottom divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none",
            isOwn ? "left-0" : "right-0"
          )}
        >
          <div className="px-2 py-2 flex gap-1 justify-center bg-gray-50 rounded-t-md">
            {["❤️", "😆", "😮", "👍", "👎", "😡"].map((emoji) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className="hover:scale-125 transition text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="p-1">
            <MenuItem>
              {({ active }) => (
                <button
                  onClick={onReply}
                  className={`${
                    active ? "bg-sky-500 text-white" : "text-gray-900"
                  } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                >
                  Trả lời
                </button>
              )}
            </MenuItem>
            {isOwn && onUnsend && (
              <MenuItem>
                {({ active }) => (
                  <button
                    onClick={onUnsend}
                    className={`${
                      active ? "bg-red-500 text-white" : "text-red-900"
                    } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                  >
                    Thu hồi
                  </button>
                )}
              </MenuItem>
            )}
          </div>
        </div>
      </Transition>
    </Menu>
  );
};

export default MessageBox;
