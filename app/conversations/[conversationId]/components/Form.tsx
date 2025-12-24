"use client";

import useConversation from "@/app/hooks/useConversation";
import axios from "axios";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import { HiPaperAirplane, HiMicrophone, HiPhoto, HiStop, HiTrash, HiPlay, HiPause } from "react-icons/hi2";
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
import toast from "react-hot-toast";

interface FormProps {
  isBot?: boolean;
  conversationUsers?: any[];
}

const Form: React.FC<FormProps> = ({ isBot, conversationUsers = [] }) => {
  const { conversationId } = useConversation();
  const { replyTo, setReplyTo } = useConversationContext();
  const [messageValue, setMessageValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);
  const [isGifModalOpen, setIsGifModalOpen] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Voice recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  
  // Get current user email
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => setCurrentUserEmail(data?.user?.email || ""))
      .catch(() => {});
  }, []);
  
  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);
  
  // Timer effect for recording
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) {
            // Auto stop
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
            }
            setIsRecording(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
    // Don't reset recordingTime when stopping - keep it for preview
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);
  
  // Check if message mentions @Gemini AI (exact match required for groups)
  const mentionsGemini = (text: string) => {
    const geminiPattern = /@gemini\s*ai/i;
    return geminiPattern.test(text);
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
    setReplyTo(null);
    
    // Clear input value directly
    if (inputRef.current) {
      (inputRef.current as any).clearInput?.();
    }

    try {
      await axios.post("/api/messages", {
        message: messageToSend,
        conversationId: conversationId,
        replyToId: replyToSend?.id 
      });

      // Call Gemini AI:
      // - In direct bot conversation: always respond
      // - In group: only respond when @gemini is mentioned
      const shouldCallGemini = isBot || mentionsGemini(messageToSend);
      
      if (shouldCallGemini) {
        try {
          // Get current user ID from session
          const sessionRes = await fetch('/api/auth/session');
          const sessionData = await sessionRes.json();
          const userId = sessionData?.user?.id;
          
          // Remove @gemini mention from message before sending to AI
          const cleanMessage = messageToSend
            .replace(/@gemini\s*ai/gi, '')
            .replace(/@gemini/gi, '')
            .trim();
          
          const geminiResponse = await axios.post('/api/gemini', {
            message: cleanMessage || messageToSend, 
            conversationId: conversationId,
            userId: userId
          });
          
          console.log('Gemini response:', geminiResponse.data);
        } catch (geminiError: any) {
          console.error('Gemini API error:', geminiError);
          // Create error message in chat
          await axios.post("/api/messages", {
            message: "⚠️ Sorry, I'm experiencing some issues right now. Please try again later!",
            conversationId: conversationId,
          }).catch(err => console.error('Failed to send error message:', err));
        }
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

  const handleVoiceRecord = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          } 
        });
        
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
        });
        
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        setRecordingTime(0); // Reset timer when starting new recording
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          stream.getTracks().forEach(track => track.stop());
          
          if (audioChunksRef.current.length === 0) {
            toast.error("No recording data");
            return;
          }
          
          const blob = new Blob(audioChunksRef.current, { 
            type: mediaRecorder.mimeType 
          });
          
          const url = URL.createObjectURL(blob);
          setAudioBlob(blob);
          setAudioUrl(url);
        };
        
        mediaRecorder.start(100);
        setIsRecording(true);
        
      } catch (err: any) {
        console.error("Microphone error:", err);
        if (err.name === "NotAllowedError") {
          toast.error("Please allow microphone access");
        } else if (err.name === "NotFoundError") {
          toast.error("Microphone not found");
        } else {
          toast.error("Cannot record: " + err.message);
        }
      }
    }
  };
  
  const cancelVoiceRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
  };
  
  const togglePlayPreview = () => {
    if (!audioPlayerRef.current || !audioUrl) return;
    
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };
  
  const sendVoiceMessage = async () => {
    if (!audioBlob) return;
    const blobToSend = audioBlob;
    cancelVoiceRecording(); // Hide preview immediately
    await uploadVoiceMessage(blobToSend);
  };
  
  const uploadVoiceMessage = async (blob: Blob) => {
    try {
      toast.loading("Sending...", { id: "voice-upload" });
      
      const formData = new FormData();
      const fileName = `voice_${Date.now()}.webm`;
      formData.append("file", blob, fileName);
      formData.append("upload_preset", "nxq0q7mq");
      formData.append("resource_type", "video");
      
      const cloudinaryRes = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload`,
        {
          method: "POST",
          body: formData,
        }
      );
      
      if (!cloudinaryRes.ok) {
        throw new Error("Upload failed");
      }
      
      const cloudinaryData = await cloudinaryRes.json();
      
      if (cloudinaryData.secure_url) {
        await axios.post("/api/messages", {
          fileUrl: cloudinaryData.secure_url,
          fileName: `🎤 Voice message`,
          fileSize: blob.size,
          conversationId,
          replyToId: replyTo?.id,
        });
        
        toast.success("Sent", { id: "voice-upload" });
        setReplyTo(null);
      } else {
        throw new Error("No URL returned");
      }
    } catch (error) {
      console.error("Voice upload error:", error);
      toast.error("Failed to send", { id: "voice-upload" });
    }
  };
  
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        
        {/* Hidden audio player for preview */}
        <audio 
          ref={audioPlayerRef} 
          src={audioUrl || undefined}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
        
        {/* Voice Recording Preview */}
        {audioBlob && audioUrl && (
          <div className="flex items-center gap-3 bg-sky-50 p-3 rounded-xl border border-sky-200">
            <button
              onClick={togglePlayPreview}
              className="p-2 bg-sky-500 text-white rounded-full hover:bg-sky-600 transition"
            >
              {isPlaying ? <HiPause size={18} /> : <HiPlay size={18} />}
            </button>
            
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700">🎤 Tin nhắn thoại</div>
              <div className="text-xs text-gray-500">{formatRecordingTime(recordingTime)}</div>
            </div>
            
            <button
              onClick={cancelVoiceRecording}
              className="p-2 text-red-500 hover:bg-red-100 rounded-full transition"
              title="Xóa"
            >
              <HiTrash size={20} />
            </button>
            
            <button
              onClick={sendVoiceMessage}
              className="p-2 bg-sky-500 text-white rounded-full hover:bg-sky-600 transition"
              title="Gửi"
            >
              <HiPaperAirplane size={18} />
            </button>
          </div>
        )}
        
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
            title={isRecording ? "Dừng ghi âm" : "Ghi âm"}
          >
            {isRecording ? <HiStop size={22} /> : <HiMicrophone size={22} />}
          </button>
          
          {/* Recording indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 px-2 py-1 bg-red-100 rounded-full">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-red-600 font-medium">
                {formatRecordingTime(recordingTime)}
              </span>
            </div>
          )}

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