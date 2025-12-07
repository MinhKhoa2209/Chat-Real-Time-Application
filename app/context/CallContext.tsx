"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { pusherClient } from "@/app/libs/pusher";
import { rtcConfig, getMediaConstraints } from "@/app/libs/webrtc";
import { CallType, IncomingCallData } from "@/app/types/call";
import axios from "axios";
import toast from "react-hot-toast";

interface CallContextType {
  // State
  isInCall: boolean;
  isRinging: boolean;
  isCalling: boolean;
  callType: CallType | null;
  callId: string | null;
  remoteUser: { id: string; name: string; image?: string } | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  callDuration: number;
  incomingCall: IncomingCallData | null;

  // Actions
  startCall: (userId: string, userName: string, userImage: string | undefined, conversationId: string, type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within CallProvider");
  }
  return context;
};


export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session } = useSession();
  const currentUserEmail = session?.user?.email;

  // Call state
  const [isInCall, setIsInCall] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState<CallType | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [remoteUser, setRemoteUser] = useState<{ id: string; name: string; image?: string } | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);

  // Refs
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const conversationIdRef = useRef<string | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    pendingCandidates.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setIsInCall(false);
    setIsRinging(false);
    setIsCalling(false);
    setCallType(null);
    setCallId(null);
    setRemoteUser(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setCallDuration(0);
    setIncomingCall(null);
    conversationIdRef.current = null;
  }, [localStream]);

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(rtcConfig);

    pc.onicecandidate = (event) => {
      if (event.candidate && currentUserEmail && remoteUser) {
        // Use API to send ICE candidate
        axios.post("/api/calls/signal", {
          type: "ice-candidate",
          targetUserId: remoteUser.id,
          payload: event.candidate,
          callId,
        }).catch(console.error);
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        endCall();
      }
    };

    return pc;
  }, [currentUserEmail, remoteUser, callId]);


  // Start outgoing call
  const startCall = useCallback(async (
    userId: string,
    userName: string,
    userImage: string | undefined,
    conversationId: string,
    type: CallType
  ) => {
    try {
      setIsCalling(true);
      setCallType(type);
      setRemoteUser({ id: userId, name: userName, image: userImage });
      conversationIdRef.current = conversationId;

      // Get local media
      const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(type === "video"));
      setLocalStream(stream);

      // Create call record
      const { data } = await axios.post("/api/calls/initiate", {
        receiverId: userId,
        conversationId,
        type,
      });
      setCallId(data.id);

      // Create peer connection
      const pc = createPeerConnection();
      peerConnection.current = pc;

      // Add tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer via API
      await axios.post("/api/calls/signal", {
        type: "offer",
        targetUserId: userId,
        payload: offer,
        callId: data.id,
        callType: type,
        callerName: session?.user?.name,
        callerImage: session?.user?.image,
        conversationId,
      });

      // Set timeout for no answer (30 seconds)
      setTimeout(() => {
        if (isCalling && !isInCall) {
          endCall();
          toast.error("Không có phản hồi");
        }
      }, 30000);

    } catch (error: any) {
      console.error("Failed to start call:", error);
      cleanup();
      if (error.name === "NotAllowedError") {
        toast.error("Vui lòng cho phép truy cập camera/microphone");
      } else {
        toast.error("Không thể bắt đầu cuộc gọi");
      }
    }
  }, [session, createPeerConnection, cleanup, isCalling, isInCall]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      setIsRinging(false);
      setIsInCall(true);
      setCallType(incomingCall.callType);
      setCallId(incomingCall.callId);
      conversationIdRef.current = incomingCall.conversationId;

      // Get local media
      const stream = await navigator.mediaDevices.getUserMedia(
        getMediaConstraints(incomingCall.callType === "video")
      );
      setLocalStream(stream);

      // Update call status
      await axios.post(`/api/calls/${incomingCall.callId}/accept`);

      // Start call timer
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      setIncomingCall(null);
    } catch (error: any) {
      console.error("Failed to accept call:", error);
      cleanup();
      if (error.name === "NotAllowedError") {
        toast.error("Vui lòng cho phép truy cập camera/microphone");
      } else {
        toast.error("Không thể chấp nhận cuộc gọi");
      }
    }
  }, [incomingCall, cleanup]);


  // Reject incoming call
  const rejectCall = useCallback(() => {
    if (!incomingCall) return;

    axios.post(`/api/calls/${incomingCall.callId}/reject`).catch(console.error);
    
    // Notify caller
    axios.post("/api/calls/signal", {
      type: "call-reject",
      targetUserId: incomingCall.callerId,
      callId: incomingCall.callId,
    }).catch(console.error);

    setIncomingCall(null);
    setIsRinging(false);
  }, [incomingCall]);

  // End call
  const endCall = useCallback(() => {
    if (callId) {
      axios.post(`/api/calls/${callId}/end`).catch(console.error);
    }

    // Notify other party
    if (remoteUser) {
      axios.post("/api/calls/signal", {
        type: "call-end",
        targetUserId: remoteUser.id,
        callId,
      }).catch(console.error);
    }

    cleanup();
  }, [callId, remoteUser, cleanup]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
    }
  }, [localStream]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff((prev) => !prev);
    }
  }, [localStream]);

  // Listen for signaling events
  useEffect(() => {
    if (!currentUserEmail) return;

    const channel = pusherClient.subscribe(currentUserEmail);

    // Handle incoming call offer
    const handleOffer = async (data: any) => {
      if (isInCall || isCalling) {
        // Already in a call, send busy signal
        axios.post("/api/calls/signal", {
          type: "call-reject",
          targetUserId: data.callerId,
          callId: data.callId,
          payload: { reason: "busy" },
        });
        return;
      }

      setIncomingCall({
        callId: data.callId,
        callType: data.callType,
        callerId: data.callerId,
        callerName: data.callerName,
        callerImage: data.callerImage,
        conversationId: data.conversationId,
      });
      setRemoteUser({
        id: data.callerId,
        name: data.callerName,
        image: data.callerImage,
      });
      setIsRinging(true);

      // Create peer connection and set remote description
      const pc = createPeerConnection();
      peerConnection.current = pc;

      await pc.setRemoteDescription(new RTCSessionDescription(data.payload));

      // Add any pending ICE candidates
      for (const candidate of pendingCandidates.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidates.current = [];
    };

    // Handle call answer
    const handleAnswer = async (data: any) => {
      if (peerConnection.current && data.callId === callId) {
        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(data.payload)
        );
        setIsCalling(false);
        setIsInCall(true);

        // Start call timer
        callTimerRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }
    };

    // Handle ICE candidate
    const handleIceCandidate = async (data: any) => {
      if (peerConnection.current) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.payload));
        } catch {
          pendingCandidates.current.push(data.payload);
        }
      } else {
        pendingCandidates.current.push(data.payload);
      }
    };

    // Handle call end
    const handleCallEnd = (data: any) => {
      if (data.callId === callId || data.callId === incomingCall?.callId) {
        cleanup();
        toast("Cuộc gọi đã kết thúc");
      }
    };

    // Handle call reject
    const handleCallReject = (data: any) => {
      if (data.callId === callId) {
        cleanup();
        const reason = data.payload?.reason;
        if (reason === "busy") {
          toast.error("Người dùng đang bận");
        } else {
          toast.error("Cuộc gọi bị từ chối");
        }
      }
    };

    channel.bind("call:offer", handleOffer);
    channel.bind("call:answer", handleAnswer);
    channel.bind("call:ice-candidate", handleIceCandidate);
    channel.bind("call:end", handleCallEnd);
    channel.bind("call:reject", handleCallReject);

    return () => {
      channel.unbind("call:offer", handleOffer);
      channel.unbind("call:answer", handleAnswer);
      channel.unbind("call:ice-candidate", handleIceCandidate);
      channel.unbind("call:end", handleCallEnd);
      channel.unbind("call:reject", handleCallReject);
    };
  }, [currentUserEmail, isInCall, isCalling, callId, incomingCall, createPeerConnection, cleanup]);


  // Create answer when accepting call
  useEffect(() => {
    const createAnswer = async () => {
      if (isInCall && peerConnection.current && localStream && incomingCall === null) {
        // Add local tracks
        localStream.getTracks().forEach((track) => {
          peerConnection.current?.addTrack(track, localStream);
        });

        // Create answer
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);

        // Send answer
        if (remoteUser && callId) {
          await axios.post("/api/calls/signal", {
            type: "answer",
            targetUserId: remoteUser.id,
            payload: answer,
            callId,
          });
        }
      }
    };

    createAnswer();
  }, [isInCall, localStream, remoteUser, callId, incomingCall]);

  const value: CallContextType = {
    isInCall,
    isRinging,
    isCalling,
    callType,
    callId,
    remoteUser,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    callDuration,
    incomingCall,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};
