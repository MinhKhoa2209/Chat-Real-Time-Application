"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
  useMemo,
} from "react";
import { useSession } from "next-auth/react";
import { getPusherClient, ensurePusherConnection } from "@/app/libs/pusher";
import {
  rtcConfig,
  rtcLogger,
  getLocalStream,
  stopStream,
  addStreamToPeerConnection,
  toggleAudio as toggleAudioTrack,
  toggleVideo as toggleVideoTrack,
} from "@/app/libs/webrtc";
import {
  CallType,
  CallStatus,
  IncomingCallData,
  CallParticipant,
} from "@/app/types/call";
import axios from "axios";
import toast from "react-hot-toast";

// Logger for call context (disabled in production)
const DEBUG = process.env.NODE_ENV === "development";
const logger = {
  log: (message: string, data?: unknown) => {
    if (DEBUG) console.log(`[CallContext] ${message}`, data || "");
  },
  error: (message: string, error?: unknown) => {
    console.error(`[CallContext] ERROR: ${message}`, error || "");
  },
};

// Context type
interface CallContextType {
  // State
  status: CallStatus;
  callId: string | null;
  callType: CallType | null;
  isGroup: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  participants: Map<string, CallParticipant>;
  callingParticipants: { id: string; name: string; image?: string }[];
  isMuted: boolean;
  isVideoOff: boolean;
  callDuration: number;
  incomingCall: IncomingCallData | null;

  // Actions
  startCall: (
    conversationId: string,
    participants: { id: string; name: string; image?: string }[],
    type: CallType,
    isGroup: boolean,
    groupName?: string
  ) => Promise<void>;
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

// Optimized axios instance for call APIs
const callApi = axios.create({
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: session, status: sessionStatus } = useSession();
  const currentUserId = session?.user?.email;
  const currentUserName = session?.user?.name || "User";
  const currentUserImage = session?.user?.image || undefined;

  // State - grouped for batch updates
  const [callState, setCallState] = useState({
    status: "idle" as CallStatus,
    callId: null as string | null,
    callType: null as CallType | null,
    isGroup: false,
    isMuted: false,
    isVideoOff: false,
    callDuration: 0,
  });

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [participants, setParticipants] = useState<Map<string, CallParticipant>>(new Map());
  const [callingParticipants, setCallingParticipants] = useState<{ id: string; name: string; image?: string }[]>([]);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);

  // Refs for stable access in callbacks
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(null);
  const statusRef = useRef<CallStatus>("idle");
  const participantsRef = useRef<{ id: string; name: string; image?: string }[]>([]);
  const conversationIdRef = useRef<string | null>(null);
  const callTypeRef = useRef<CallType | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const callConnectedRef = useRef<boolean>(false);
  const cleanupInProgressRef = useRef<boolean>(false);

  // Update refs when state changes
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { callIdRef.current = callState.callId; }, [callState.callId]);
  useEffect(() => { statusRef.current = callState.status; }, [callState.status]);
  useEffect(() => { callTypeRef.current = callState.callType; }, [callState.callType]);
  useEffect(() => {
    if (callState.status === "connected" && !callConnectedRef.current) {
      callConnectedRef.current = true;
      callStartTimeRef.current = Date.now();
    }
  }, [callState.status]);

  // Log session status for debugging
  useEffect(() => {
    logger.log(`Session status: ${sessionStatus}, userId: ${currentUserId || "none"}`);
  }, [sessionStatus, currentUserId]);

  // Ensure Pusher stays connected
  useEffect(() => {
    if (!currentUserId) return;

    const checkConnection = () => {
      const client = getPusherClient();
      if (client.connection.state !== "connected" && client.connection.state !== "connecting") {
        logger.log("Pusher disconnected, reconnecting...");
        ensurePusherConnection();
      }
    };

    // Check connection every 10 seconds
    const interval = setInterval(checkConnection, 10000);
    
    // Initial check
    checkConnection();

    return () => clearInterval(interval);
  }, [currentUserId]);

  // Generate unique call ID - optimized
  const generateCallId = useCallback(() => 
    `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, []);

  // Cleanup function - optimized with ref check
  const cleanup = useCallback(() => {
    if (cleanupInProgressRef.current) return;
    cleanupInProgressRef.current = true;
    
    logger.log("Cleanup started");

    // Stop local stream
    stopStream(localStreamRef.current);
    setLocalStream(null);
    localStreamRef.current = null;

    // Close all peer connections in parallel
    const closePromises: Promise<void>[] = [];
    peerConnections.current.forEach((pc, oderId) => {
      closePromises.push(new Promise((resolve) => {
        logger.log(`Closing peer connection for ${oderId}`);
        pc.close();
        resolve();
      }));
    });
    peerConnections.current.clear();
    pendingCandidates.current.clear();

    // Clear timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    // Batch reset state
    setCallState({
      status: "idle",
      callId: null,
      callType: null,
      isGroup: false,
      isMuted: false,
      isVideoOff: false,
      callDuration: 0,
    });
    setRemoteStreams(new Map());
    setParticipants(new Map());
    setCallingParticipants([]);
    setIncomingCall(null);

    // Reset refs
    callIdRef.current = null;
    statusRef.current = "idle";
    participantsRef.current = [];
    callTypeRef.current = null;
    callStartTimeRef.current = null;
    callConnectedRef.current = false;
    cleanupInProgressRef.current = false;

    logger.log("Cleanup completed");
  }, []);

  // Send call message to conversation - non-blocking
  const sendCallMessage = useCallback((
    convId: string,
    type: CallType,
    status: "missed" | "rejected" | "ended",
    duration?: number
  ) => {
    // Fire and forget - don't await
    callApi.post("/api/calls/message", {
      conversationId: convId,
      callType: type,
      callStatus: status,
      duration,
    }).then(() => {
      logger.log("Call message sent", { convId, type, status, duration });
    }).catch((error) => {
      logger.error("Failed to send call message", error);
    });
  }, []);

  // Send signaling message - optimized with retry
  const sendSignal = useCallback(async (
    type: string,
    targetUserId: string,
    payload?: unknown,
    extraData?: Record<string, unknown>
  ) => {
    const maxRetries = 2;
    let lastError: unknown;

    for (let i = 0; i <= maxRetries; i++) {
      try {
        logger.log(`Sending signal: ${type} to ${targetUserId}`);
        await callApi.post("/api/calls/signal", {
          type,
          targetUserId,
          payload,
          callId: callIdRef.current,
          ...extraData,
        });
        logger.log(`Signal sent successfully: ${type}`);
        return;
      } catch (error) {
        lastError = error;
        if (i < maxRetries) {
          await new Promise(r => setTimeout(r, 100 * (i + 1)));
        }
      }
    }
    logger.error(`Failed to send signal after retries: ${type}`, lastError);
  }, []);

  // Create peer connection for a participant - optimized
  const createPeerConnectionForParticipant = useCallback((
    oderId: string,
    oderName: string,
    oderImage?: string
  ): RTCPeerConnection => {
    logger.log(`Creating peer connection for ${oderName} (${oderId})`);

    const pc = new RTCPeerConnection(rtcConfig);

    // Handle ICE candidates - batch send
    let iceCandidateBuffer: RTCIceCandidate[] = [];
    let iceSendTimeout: NodeJS.Timeout | null = null;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        rtcLogger.log("ICE", `New candidate for ${oderId}`);
        // Send immediately for faster connection
        sendSignal("ice-candidate", oderId, event.candidate);
      }
    };

    // Handle remote tracks
    pc.ontrack = (event) => {
      rtcLogger.log("Track", `Received track from ${oderId}: ${event.track.kind}`);
      if (event.streams[0]) {
        setRemoteStreams((prev) => {
          const newMap = new Map(prev);
          newMap.set(oderId, event.streams[0]);
          return newMap;
        });
        setParticipants((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(oderId);
          newMap.set(oderId, {
            id: oderId,
            name: oderName,
            image: oderImage,
            stream: event.streams[0],
            isMuted: existing?.isMuted || false,
            isVideoOff: existing?.isVideoOff || false,
          });
          return newMap;
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      rtcLogger.log("Connection", `State for ${oderId}: ${pc.connectionState}`);
      if (pc.connectionState === "connected") {
        setCallState(prev => ({ ...prev, status: "connected" }));
        // Start call timer if not already started
        if (!callTimerRef.current) {
          callTimerRef.current = setInterval(() => {
            setCallState(prev => ({ ...prev, callDuration: prev.callDuration + 1 }));
          }, 1000);
        }
      } else if (pc.connectionState === "failed") {
        // Only cleanup on failed, not disconnected (disconnected can be temporary)
        logger.log(`Connection failed for ${oderId}, removing participant`);
        peerConnections.current.delete(oderId);
        setRemoteStreams((prev) => {
          const newMap = new Map(prev);
          newMap.delete(oderId);
          return newMap;
        });
        setParticipants((prev) => {
          const newMap = new Map(prev);
          newMap.delete(oderId);
          return newMap;
        });
        // If no more participants and call was connected, end call
        if (peerConnections.current.size === 0 && callConnectedRef.current) {
          cleanup();
          toast("Call ended");
        }
      }
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      rtcLogger.log("ICE", `Connection state for ${oderId}: ${pc.iceConnectionState}`);
      // Handle ICE restart if needed
      if (pc.iceConnectionState === "failed") {
        pc.restartIce();
      }
    };

    peerConnections.current.set(oderId, pc);
    return pc;
  }, [sendSignal, cleanup]);

  // Start outgoing call - optimized
  const startCall = useCallback(async (
    conversationId: string,
    callParticipants: { id: string; name: string; image?: string }[],
    type: CallType,
    isGroupCall: boolean,
    groupName?: string
  ) => {
    if (statusRef.current !== "idle") {
      toast.error("You are already in a call");
      return;
    }

    logger.log("Starting call", { conversationId, participants: callParticipants.length, type, isGroupCall });

    try {
      const newCallId = generateCallId();
      
      // Batch state update
      setCallState({
        status: "ringing",
        callId: newCallId,
        callType: type,
        isGroup: isGroupCall,
        isMuted: false,
        isVideoOff: false,
        callDuration: 0,
      });
      setCallingParticipants(callParticipants);
      
      callIdRef.current = newCallId;
      participantsRef.current = callParticipants;
      conversationIdRef.current = conversationId;

      // Get local media
      const stream = await getLocalStream(type === "video");
      setLocalStream(stream);
      localStreamRef.current = stream;

      // Create call record in database - non-blocking
      callApi.post("/api/calls/initiate", {
        callId: newCallId,
        conversationId,
        type,
        isGroup: isGroupCall,
        participantIds: callParticipants.map((p) => p.id),
      }).catch(() => {});

      // For each participant, create peer connection and send offer in parallel
      const offerPromises = callParticipants.map(async (participant) => {
        const pc = createPeerConnectionForParticipant(
          participant.id,
          participant.name,
          participant.image
        );

        // Add local tracks
        addStreamToPeerConnection(pc, stream);

        // Create and send offer with optimized SDP
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: type === "video",
        });
        await pc.setLocalDescription(offer);

        await sendSignal("offer", participant.id, offer, {
          callType: type,
          callerName: currentUserName,
          callerImage: currentUserImage,
          conversationId,
          isGroup: isGroupCall,
          groupName,
        });
      });

      await Promise.all(offerPromises);

      // Set timeout for no answer - reduced to 25s for faster feedback
      setTimeout(() => {
        if (statusRef.current === "ringing") {
          logger.log("Call timeout - no answer");
          if (conversationIdRef.current && callTypeRef.current) {
            sendCallMessage(conversationIdRef.current, callTypeRef.current, "missed");
          }
          cleanup();
          toast.error("No response");
        }
      }, 25000);

    } catch (error: unknown) {
      logger.error("Failed to start call", error);
      cleanup();
      const err = error as Error & { name?: string };
      if (err.name === "NotAllowedError") {
        toast.error("Please allow camera/microphone access");
      } else {
        toast.error("Failed to start call");
      }
    }
  }, [currentUserName, currentUserImage, createPeerConnectionForParticipant, sendSignal, cleanup, sendCallMessage, generateCallId]);

  // Accept incoming call - optimized
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;

    logger.log("Accepting call", incomingCall);

    try {
      const { callId: incCallId, callType: incCallType, callerId, conversationId, isGroup: incIsGroup } = incomingCall;

      // Batch state update
      setCallState(prev => ({
        ...prev,
        status: "connecting",
        callId: incCallId,
        callType: incCallType,
        isGroup: incIsGroup,
      }));
      
      callIdRef.current = incCallId;
      conversationIdRef.current = conversationId;

      // Get local media
      const stream = await getLocalStream(incCallType === "video");
      setLocalStream(stream);
      localStreamRef.current = stream;

      // Get existing peer connection
      const pc = peerConnections.current.get(callerId);
      if (!pc) {
        throw new Error("Peer connection not found");
      }

      // Add local tracks
      addStreamToPeerConnection(pc, stream);

      // Create and send answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendSignal("answer", callerId, answer);

      // Update call status in database - non-blocking
      callApi.post(`/api/calls/${incCallId}/accept`).catch(() => {});

      setIncomingCall(null);
      logger.log("Call accepted successfully");

    } catch (error: unknown) {
      logger.error("Failed to accept call", error);
      cleanup();
      const err = error as Error & { name?: string };
      if (err.name === "NotAllowedError") {
        toast.error("Please allow camera/microphone access");
      } else {
        toast.error("Failed to accept call");
      }
    }
  }, [incomingCall, sendSignal, cleanup]);

  // Reject incoming call - optimized
  const rejectCall = useCallback(() => {
    if (!incomingCall) return;

    logger.log("Rejecting call", incomingCall.callId);

    // Send rejected message - non-blocking
    sendCallMessage(
      incomingCall.conversationId,
      incomingCall.callType,
      "rejected"
    );

    // Send signal and update DB - non-blocking
    sendSignal("call-reject", incomingCall.callerId, { reason: "rejected" });
    callApi.post(`/api/calls/${incomingCall.callId}/reject`).catch(() => {});

    // Cleanup peer connection
    const pc = peerConnections.current.get(incomingCall.callerId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(incomingCall.callerId);
    }

    setIncomingCall(null);
    setCallState(prev => ({ ...prev, status: "idle" }));
  }, [incomingCall, sendSignal, sendCallMessage]);

  // End call - optimized for faster sync
  const endCall = useCallback(async () => {
    logger.log("Ending call", callIdRef.current);

    // Calculate duration
    let duration: number | undefined;
    if (callConnectedRef.current && callStartTimeRef.current) {
      duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
    }

    // IMPORTANT: Send end signal to all participants FIRST and wait for it
    // This ensures the other side receives the signal before we cleanup
    const signalPromises: Promise<void>[] = [];
    peerConnections.current.forEach((_, oderId) => {
      signalPromises.push(sendSignal("call-end", oderId, { reason: "ended" }));
    });

    // Wait for all signals to be sent (with timeout)
    try {
      await Promise.race([
        Promise.all(signalPromises),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000))
      ]);
      logger.log("All end signals sent successfully");
    } catch (err) {
      logger.log("Some end signals may have failed, continuing cleanup");
    }

    // Send call message - non-blocking
    if (conversationIdRef.current && callTypeRef.current) {
      sendCallMessage(
        conversationIdRef.current,
        callTypeRef.current,
        "ended",
        duration
      );
    }

    // Update DB - non-blocking
    if (callIdRef.current) {
      callApi.post(`/api/calls/${callIdRef.current}/end`).catch(() => {});
    }

    cleanup();
    toast("Call ended");
  }, [sendSignal, cleanup, sendCallMessage]);

  // Toggle mute - optimized
  const toggleMute = useCallback(() => {
    const newMuted = toggleAudioTrack(localStreamRef.current);
    setCallState(prev => ({ ...prev, isMuted: newMuted }));
    logger.log(`Mute toggled: ${newMuted}`);
  }, []);

  // Toggle video - optimized
  const toggleVideo = useCallback(() => {
    const newVideoOff = toggleVideoTrack(localStreamRef.current);
    setCallState(prev => ({ ...prev, isVideoOff: newVideoOff }));
    logger.log(`Video toggled: ${newVideoOff}`);
  }, []);

  // Handle incoming signaling messages
  useEffect(() => {
    if (!currentUserId) {
      logger.log("No currentUserId, skipping subscription");
      return;
    }

    // Ensure Pusher is connected
    ensurePusherConnection();
    
    const client = getPusherClient();
    logger.log(`Subscribing to call channel: ${currentUserId}, state: ${client.connection?.state}`);
    
    // Subscribe to channel
    const channel = client.subscribe(currentUserId);
    
    // Log subscription events
    channel.bind("pusher:subscription_succeeded", () => {
      logger.log(`Subscription succeeded for: ${currentUserId}`);
    });
    
    channel.bind("pusher:subscription_error", (err: Error) => {
      logger.error(`Subscription error for: ${currentUserId}`, err);
    });

    // Handle incoming offer
    const handleOffer = async (data: {
      callId: string;
      callerId: string;
      callerName: string;
      callerImage?: string;
      callType: CallType;
      conversationId: string;
      isGroup: boolean;
      groupName?: string;
      payload: RTCSessionDescriptionInit;
    }) => {
      logger.log("Received call offer", { 
        callId: data.callId, 
        from: data.callerName, 
        type: data.callType,
        currentStatus: statusRef.current,
        currentCallId: callIdRef.current,
        isGroup: data.isGroup,
      });
      
      // If already in a call
      if (statusRef.current !== "idle") {
        // Check if this is from the same group call (same conversation)
        // or if we're already connected to this caller
        const existingPc = peerConnections.current.get(data.callerId);
        
        if (existingPc) {
          logger.log("Already have connection to this caller, ignoring duplicate offer");
          return;
        }
        
        // If it's a group call and we're in the same conversation, accept new participant
        if (data.isGroup && conversationIdRef.current === data.conversationId) {
          logger.log("Same group call, accepting new participant");
          // Continue to create peer connection for new participant
        } else {
          // Different call, send busy
          logger.log("Already in different call, sending busy signal");
          sendSignal("call-reject", data.callerId, { reason: "busy" });
          return;
        }
      } else {
        // Not in a call, set incoming call state
        setIncomingCall({
          callId: data.callId,
          callType: data.callType,
          callerId: data.callerId,
          callerName: data.callerName,
          callerImage: data.callerImage,
          conversationId: data.conversationId,
          isGroup: data.isGroup,
          groupName: data.groupName,
        });
        setCallState(prev => ({ ...prev, status: "ringing" }));
        callIdRef.current = data.callId;
        conversationIdRef.current = data.conversationId;
      }

      // Create peer connection and set remote description
      const pc = createPeerConnectionForParticipant(
        data.callerId,
        data.callerName,
        data.callerImage
      );
      await pc.setRemoteDescription(new RTCSessionDescription(data.payload));

      // Add any pending ICE candidates
      const pending = pendingCandidates.current.get(data.callerId) || [];
      await Promise.all(pending.map(candidate => 
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
      ));
      pendingCandidates.current.delete(data.callerId);

      // If already in a connected call (group call), auto-accept new participant
      if (statusRef.current === "connected" || statusRef.current === "connecting") {
        logger.log("Auto-accepting new participant in ongoing call");
        try {
          // Add local tracks if we have them
          if (localStreamRef.current) {
            addStreamToPeerConnection(pc, localStreamRef.current);
          }
          
          // Create and send answer
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal("answer", data.callerId, answer);
          logger.log("Auto-answer sent to new participant");
        } catch (err) {
          logger.error("Failed to auto-accept participant", err);
        }
      }
    };

    // Handle answer
    const handleAnswer = async (data: {
      callId: string;
      callerId: string;
      payload: RTCSessionDescriptionInit;
    }) => {
      const pc = peerConnections.current.get(data.callerId);
      if (pc && data.callId === callIdRef.current) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
        setCallState(prev => ({ ...prev, status: "connecting" }));
      }
    };

    // Handle ICE candidate - optimized
    const handleIceCandidate = async (data: {
      callerId: string;
      payload: RTCIceCandidateInit;
    }) => {
      rtcLogger.log("ICE", `Received candidate from ${data.callerId}`);

      const pc = peerConnections.current.get(data.callerId);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.payload));
        } catch {
          // Store for later
          const pending = pendingCandidates.current.get(data.callerId) || [];
          pending.push(data.payload);
          pendingCandidates.current.set(data.callerId, pending);
        }
      } else {
        // Store for later
        const pending = pendingCandidates.current.get(data.callerId) || [];
        pending.push(data.payload);
        pendingCandidates.current.set(data.callerId, pending);
      }
    };

    // Handle call end
    const handleCallEnd = (data: { callId: string; callerId: string }) => {
      logger.log("Received call end from", data.callerId);

      const pc = peerConnections.current.get(data.callerId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(data.callerId);
      }

      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        newMap.delete(data.callerId);
        return newMap;
      });

      setParticipants((prev) => {
        const newMap = new Map(prev);
        newMap.delete(data.callerId);
        return newMap;
      });

      if (peerConnections.current.size === 0) {
        cleanup();
        toast("Call ended");
      }
    };

    // Handle call reject
    const handleCallReject = (data: { callId: string; callerId: string; payload?: { reason?: string } }) => {
      logger.log("Received call reject from " + data.callerId, { currentCallId: callIdRef.current, receivedCallId: data.callId });

      // Only process if this is for our current call
      if (data.callId !== callIdRef.current) {
        logger.log("Ignoring reject for different call");
        return;
      }

      const pc = peerConnections.current.get(data.callerId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(data.callerId);
      }

      // Always cleanup when we receive a reject for our call
      cleanup();
      if (data.payload?.reason === "busy") {
        toast.error("User is busy");
      } else {
        toast.error("Call rejected");
      }
    };

    channel.bind("call:offer", handleOffer);
    channel.bind("call:answer", handleAnswer);
    channel.bind("call:ice-candidate", handleIceCandidate);
    channel.bind("call:call-end", handleCallEnd);
    channel.bind("call:call-reject", handleCallReject);

    logger.log("Call event handlers bound successfully");

    return () => {
      logger.log(`Cleanup handlers for channel: ${currentUserId}`);
      // Only unbind call events, don't unsubscribe the channel
      // because other components also use this channel
      channel.unbind("call:offer", handleOffer);
      channel.unbind("call:answer", handleAnswer);
      channel.unbind("call:ice-candidate", handleIceCandidate);
      channel.unbind("call:call-end", handleCallEnd);
      channel.unbind("call:call-reject", handleCallReject);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]); // Only re-subscribe when userId changes

  // Memoized context value to prevent unnecessary re-renders
  const value = useMemo<CallContextType>(() => ({
    status: callState.status,
    callId: callState.callId,
    callType: callState.callType,
    isGroup: callState.isGroup,
    localStream,
    remoteStreams,
    participants,
    callingParticipants,
    isMuted: callState.isMuted,
    isVideoOff: callState.isVideoOff,
    callDuration: callState.callDuration,
    incomingCall,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  }), [
    callState,
    localStream,
    remoteStreams,
    participants,
    callingParticipants,
    incomingCall,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  ]);

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};
