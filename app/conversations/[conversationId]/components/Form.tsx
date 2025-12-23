"use client";

import useConversation from "@/app/hooks/useConversation";
import axios from "axios";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import { HiPaperAirplane, HiMicrophone, HiPhoto } from "react-icons/hi2";
import { BsStickiesFill } from "react-icons/bs";
import { MdGif } from "react-icons/md";
import { BiSolidLike } from "react-icons/bi";
import MessageInput from "./MessageInput";
import { CldUploadButton, type CloudinaryUploadWidgetResults } from "next-cloudinary";
import { useConversationContext } from "../ConversationContext"; 
import { XMarkIcon } from "@heroicons/react/24/solid";
import { useState, useEffect, useRef } from "react";
import StickerModal from "./StickerModal";
import GifModal from "./GifModal";

interface FormProps {
  isBot?: boolean;
  conversationUsers?: any[];
}

const Form: React.FC<FormProps> = ({ isBot, conversationUsers = [] }) => {
  const { conversationId } = useConversation();
  const { replyTo, setReplyTo } = useConversationContext();
  const [messageValue, setMessageValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);
  const [isGifModalOpen, setIsGifModalOpen] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Get current user email
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => setCurrentUserEmail(data?.user?.email || ""))
      .catch(() => {});
  }, []);
  
  // Check if message mentions Gemini
  const mentionsGemini = (text: string) => {
    return text.toLowerCase().includes('@gemini') || text.toLowerCase().includes('@gemini ai');
  };

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FieldValues>({
    defaultValues: {
      message: "",
    },
  });

  const onSubmit: SubmitHandler<FieldValues> = async (data) => {
    if (!data.message || data.message.trim() === "") {
      return;
    }

    const messageToSend = data.message;
    const replyToSend = replyTo;

    // Clear form IMMEDIATELY before sending
    setValue("message", "", { shouldValidate: false });
    setMessageValue("");
    setInputKey(prev => prev + 1);
    setReplyTo(null);

    try {
      await axios.post("/api/messages", {
        message: messageToSend,
        conversationId: conversationId,
        replyToId: replyToSend?.id 
      });

      // Call Gemini AI if this is a bot conversation
      // No need to mention @gemini when chatting directly with AI
      if (isBot) {
        // Get current user ID from session
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();
        const userId = sessionData?.user?.id;
        
        axios.post('/api/gemini', {
          message: messageToSend, 
          conversationId: conversationId,
          userId: userId
        });
      }

      // Re-focus input after sending (like Messenger)
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    } catch (error: any) {
      console.error("Message submission error:", error);
      // Restore message on error
      setValue("message", messageToSend);
      setMessageValue(messageToSend);
      setReplyTo(replyToSend);
      alert(`Failed to send message: ${error.response?.data || error.message}`);
    }
  };

  const handleVoiceRecord = () => {
    setIsRecording(!isRecording);
    console.log("Voice recording:", !isRecording);
  };

  const resolveSecureUrl = (info?: { secure_url?: string; resource_type?: string; format?: string }) => {
    if (!info?.secure_url) {
      return undefined;
    }
    
    // Danh sách các format file không phải ảnh/video thực sự
    const documentFormats = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "zip", "rar", "7z"];
    const videoFormats = ["mp4", "mov", "avi", "mkv", "webm", "flv"];
    const format = info.format?.toLowerCase() || '';
    
    const isDocumentFile = documentFormats.includes(format);
    const isVideoFile = videoFormats.includes(format);
    const isRawType = info.resource_type === "raw";

    // Nếu là file document, chuyển sang /raw/upload
    if (isRawType || isDocumentFile) {
      let url = info.secure_url;
      // Thay thế /image/upload hoặc /video/upload thành /raw/upload
      if (url.includes("/image/upload")) {
        url = url.replace("/image/upload", "/raw/upload");
      } else if (url.includes("/video/upload")) {
        url = url.replace("/video/upload", "/raw/upload");
      }
      console.log("Resolved document URL:", { original: info.secure_url, resolved: url });
      return url;
    }
    
    // Video giữ nguyên URL
    if (isVideoFile) {
      console.log("Video URL:", info.secure_url);
      return info.secure_url;
    }

    return info.secure_url;
  };

  return (
    <>
      <StickerModal
        isOpen={isStickerModalOpen}
        onClose={() => setIsStickerModalOpen(false)}
        conversationId={conversationId || ""}
      />
      
      <GifModal
        isOpen={isGifModalOpen}
        onClose={() => setIsGifModalOpen(false)}
        conversationId={conversationId || ""}
      />

      <div className="py-4 px-4 bg-white border-t flex flex-col gap-2 lg:gap-4 w-full z-10">
        
        {replyTo && (
        <div className="flex items-center justify-between bg-gray-100 p-2 rounded-lg border-l-4 border-sky-500 text-sm text-gray-600 animate-fade-in-up">
           <div className="flex flex-col overflow-hidden mr-2">
              <span className="font-bold text-sky-600 text-xs mb-1">
                Replying to {replyTo.sender.name}
              </span>
              <span className="truncate opacity-75 text-xs">
                {replyTo.image
                  ? "📷 [Image]"
                  : replyTo.fileUrl
                  ? "📎 [File]"
                  : replyTo.body}
              </span>
           </div>
           <button 
             onClick={() => setReplyTo(null)}
             className="p-1 hover:bg-gray-200 rounded-full transition"
           >
             <XMarkIcon className="h-5 w-5 text-gray-500 hover:text-red-500"/>
           </button>
        </div>
      )}
      <div className="flex items-center gap-2 w-full">
        {/* Left Action Buttons - Messenger Style */}
        <div className="flex items-center gap-0">
          {/* Voice Recording */}
          <button
            type="button"
            onClick={handleVoiceRecord}
            className={`p-2 transition rounded-full hover:bg-gray-100 ${
              isRecording ? "text-red-500 animate-pulse" : "text-sky-500 hover:text-sky-600"
            }`}
            title="Voice Record"
          >
            <HiMicrophone size={22} />
          </button>

          {/* Image/Video/File Upload */}
          <CldUploadButton
            options={{ 
              maxFiles: 1,
              maxFileSize: 100000000,
              resourceType: "auto",
              clientAllowedFormats: ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "zip", "rar", "mp4", "mov", "avi", "mkv", "webm"],
            }}
            onSuccess={(result) => {
              try {
                const info = typeof result.info === "string" ? undefined : result.info;
                if (!info?.secure_url) {
                  console.error("No secure URL in upload result");
                  return;
                }

                console.log("Upload info:", {
                  secure_url: info.secure_url,
                  resource_type: info.resource_type,
                  format: info.format,
                  original_filename: info.original_filename,
                  bytes: info.bytes,
                });

                const imageFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
                const documentFormats = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar'];
                
                const fileFormat = info.format?.toLowerCase() || '';
                
                console.log("File format check:", {
                  fileFormat,
                  isDocument: documentFormats.includes(fileFormat),
                  isInImageFormats: imageFormats.includes(fileFormat),
                });
                
                const urlHasDocExtension = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar)$/i.test(info.secure_url);
                const isDocument = documentFormats.includes(fileFormat) || urlHasDocExtension;
                const isImage = !isDocument && imageFormats.includes(fileFormat);
                
                console.log("Classification:", { isDocument, isImage, urlHasDocExtension });
                
                if (isImage) {
                  // Send real image
                  console.log("Sending image/video:", info.secure_url);
                  axios.post("/api/messages", {
                    image: info.secure_url,
                    conversationId,
                    replyToId: replyTo?.id,
                  }).then(() => {
                    console.log("Image sent successfully");
                  }).catch(err => {
                    console.error("Error sending image:", err);
                  });
                } else {
                  // Handle file (PDF, DOC, video, etc.)
                  const secureUrl = resolveSecureUrl(info);
                  const extension = info?.format ? `.${info.format}` : "";
                  const derivedName = info?.original_filename
                    ? `${info.original_filename}${extension}`
                    : info?.public_id;

                  console.log("Sending file:", {
                    originalUrl: info.secure_url,
                    resolvedUrl: secureUrl,
                    fileName: derivedName,
                    fileSize: info?.bytes,
                    format: info?.format,
                    resource_type: info?.resource_type,
                  });

                  // Do NOT send image field, only fileUrl
                  const fileData: any = {
                    fileUrl: secureUrl,
                    fileName: derivedName,
                    fileSize: info?.bytes,
                    conversationId,
                  };
                  
                  console.log("File data to send:", JSON.stringify(fileData, null, 2));

                  if (replyTo?.id) {
                    fileData.replyToId = replyTo.id;
                  }

                  axios.post("/api/messages", fileData).then(() => {
                    console.log("File sent successfully");
                  }).catch(err => {
                    console.error("Error sending file:", err);
                  });
                }
                setReplyTo(null);
              } catch (error) {
                console.error("Upload handler error:", error);
              }
            }}
            onError={(error) => {
              console.error("Upload error:", error);
              alert("Upload error. Please try again!");
            }}
            uploadPreset="nxq0q7mq"
          >
            <div 
              className="p-2 text-sky-500 hover:text-sky-600 cursor-pointer transition rounded-full hover:bg-gray-100" 
              title="Image, video or file"
            >
              <HiPhoto size={22} />
            </div>
          </CldUploadButton>

          {/* Sticker */}
          <button
            type="button"
            className="p-2 text-sky-500 hover:text-sky-600 transition rounded-full hover:bg-gray-100"
            title="Sticker"
            onClick={() => setIsStickerModalOpen(true)}
          >
            <BsStickiesFill size={20} />
          </button>

          {/* GIF */}
          <button
            type="button"
            className="p-2 text-sky-500 hover:text-sky-600 transition rounded-full hover:bg-gray-100"
            title="GIF"
            onClick={() => setIsGifModalOpen(true)}
          >
            <MdGif size={24} />
          </button>
        </div>
        
        {/* Message Input Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex items-center gap-2 flex-1"
        >
          <MessageInput
            key={inputKey}
            id="message"
            register={register}
            errors={errors}
            required={!replyTo}
            placeholder="Aa"
            onValueChange={setMessageValue}
            conversationUsers={conversationUsers}
            currentUserEmail={currentUserEmail}
            inputRef={inputRef}
          />
          
          {/* Send Button or Like */}
          {messageValue.trim() ? (
            <button
              type="submit"
              className="rounded-full p-2 bg-sky-500 cursor-pointer hover:bg-sky-600 transition flex-shrink-0"
              title="Send"
            >
              <HiPaperAirplane size={18} className="text-white" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                axios.post("/api/messages", {
                  message: "👍",
                  conversationId,
                  replyToId: replyTo?.id,
                }).catch(err => {
                  console.error("Error sending like:", err);
                });
                setReplyTo(null);
              }}
              className="p-2 text-sky-500 hover:text-sky-600 transition rounded-full hover:bg-gray-100 flex-shrink-0"
              title="Like"
            >
              <BiSolidLike size={22} />
            </button>
          )}
        </form>
      </div>
    </div>
    </>
  );
};

export default Form;