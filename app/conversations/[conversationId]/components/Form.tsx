"use client";

import useConversation from "@/app/hooks/useConversation";
import axios from "axios";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import { HiPaperAirplane, HiPhoto, HiOutlinePaperClip } from "react-icons/hi2";
import MessageInput from "./MessageInput";
import { CldUploadButton, type CloudinaryUploadWidgetResults } from "next-cloudinary";
import { useConversationContext } from "../ConversationContext"; 
import { XMarkIcon } from "@heroicons/react/24/solid";

interface FormProps {
  isBot?: boolean;
}

const Form: React.FC<FormProps> = ({ isBot }) => {
  const { conversationId } = useConversation();
  const { replyTo, setReplyTo } = useConversationContext();

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
    setValue("message", "", { shouldValidate: true });

    try {
      await axios.post("/api/messages", {
        ...data,
        conversationId: conversationId,
        replyToId: replyTo?.id 
      });

      if (isBot && data.message) {
        await axios.post('/api/gemini', {
          message: data.message, 
          conversationId: conversationId
        });
      }
    } catch (error) {
      console.error("Message submission error:", error);
    } finally {
      setReplyTo(null);
    }
  };

  const handleUpload = (result: CloudinaryUploadWidgetResults) => {
    const info = typeof result.info === "string" ? undefined : result.info;
    if (!info?.secure_url) {
      return;
    }

    axios.post("/api/messages", {
      image: info.secure_url,
      conversationId,
      replyToId: replyTo?.id 
    });
    setReplyTo(null);
  };

  const resolveSecureUrl = (info?: { secure_url?: string; resource_type?: string; format?: string }) => {
    if (!info?.secure_url) {
      return undefined;
    }
    const isRawType = info.resource_type === "raw";
    const isDocumentFile = info.format && ["pdf", "doc", "docx", "xls", "xlsx", "zip", "rar"].includes(info.format);

    if (isRawType || isDocumentFile) {
      return info.secure_url.replace("/image/upload", "/raw/upload");
    }

    return info.secure_url;
  };

  const handleFileUpload = (result: CloudinaryUploadWidgetResults) => {
    const info = typeof result.info === "string" ? undefined : result.info;
    const secureUrl = resolveSecureUrl(info);

    if (!secureUrl) {
      return;
    }

    const extension = info?.format ? `.${info.format}` : "";
    const derivedName = info?.original_filename
      ? `${info.original_filename}${extension}`
      : info?.public_id;

    axios.post("/api/messages", {
      fileUrl: secureUrl, // URL đã được fix
      fileName: derivedName,
      fileSize: info?.bytes,
      fileType: info?.resource_type,
      conversationId,
      replyToId: replyTo?.id,
    });

    setReplyTo(null);
  };

  return (
    <div className="py-4 px-4 bg-white border-t flex flex-col gap-2 lg:gap-4 w-full z-10">
      
      {replyTo && (
        <div className="flex items-center justify-between bg-gray-100 p-2 rounded-lg border-l-4 border-sky-500 text-sm text-gray-600 animate-fade-in-up">
           <div className="flex flex-col overflow-hidden mr-2">
              <span className="font-bold text-sky-600 text-xs mb-1">
                Đang trả lời {replyTo.sender.name}
              </span>
              <span className="truncate opacity-75 text-xs">
                {replyTo.image
                  ? "📷 [Hình ảnh]"
                  : replyTo.fileUrl
                  ? "📎 [Tệp đính kèm]"
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
      <div className="flex items-center gap-2 lg:gap-4 w-full">
        <div className="flex items-center gap-2">
          <CldUploadButton
            options={{ maxFiles: 1 }}
            onSuccess={handleUpload}
            uploadPreset="nxq0q7mq"
          >
            <HiPhoto
              size={30}
              className="text-sky-500 hover:text-sky-600 cursor-pointer transition"
            />
          </CldUploadButton>
          <CldUploadButton
            options={{ maxFiles: 1, resourceType: "raw" }}
            onSuccess={handleFileUpload}
            uploadPreset="nxq0q7mq"
          >
            <HiOutlinePaperClip
              size={26}
              className="text-slate-500 hover:text-slate-700 cursor-pointer transition"
            />
          </CldUploadButton>
        </div>
        
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex items-center gap-2 lg:gap-4 w-full"
        >
          <MessageInput
            id="message"
            register={register}
            errors={errors}
            required={!replyTo}
            placeholder={isBot ? "Hỏi Gemini điều gì đó..." : "Viết tin nhắn..."}
          />
          
          <button
            type="submit"
            className="rounded-full p-2 bg-sky-500 cursor-pointer hover:bg-sky-600 transition"
          >
            <HiPaperAirplane size={18} className="text-white" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Form;