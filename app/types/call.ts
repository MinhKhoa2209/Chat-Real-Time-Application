// Call Types
export type CallType = "voice" | "video";
export type CallStatus = "idle" | "ringing" | "connecting" | "connected" | "ended";

// Participant in a call
export interface CallParticipant {
  id: string;
  name: string;
  image?: string;
  stream?: MediaStream;
  isMuted: boolean;
  isVideoOff: boolean;
}

// Incoming call data
export interface IncomingCallData {
  callId: string;
  callType: CallType;
  callerId: string;
  callerName: string;
  callerImage?: string;
  conversationId: string;
  isGroup: boolean;
  groupName?: string;
}

// Signaling message types
export type SignalType = 
  | "offer" 
  | "answer" 
  | "ice-candidate" 
  | "call-end" 
  | "call-reject"
  | "call-accept"
  | "participant-joined"
  | "participant-left";

// Signaling payload
export interface SignalPayload {
  type: SignalType;
  callId: string;
  senderId: string;
  targetUserId?: string; // For 1-1 calls
  conversationId?: string; // For group calls
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit | { reason?: string };
  callType?: CallType;
  callerName?: string;
  callerImage?: string;
  isGroup?: boolean;
  groupName?: string;
}

// Call state for context
export interface CallState {
  status: CallStatus;
  callId: string | null;
  callType: CallType | null;
  isGroup: boolean;
  conversationId: string | null;
  participants: Map<string, CallParticipant>;
  localStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  callDuration: number;
  incomingCall: IncomingCallData | null;
}

// Initial call state
export const initialCallState: CallState = {
  status: "idle",
  callId: null,
  callType: null,
  isGroup: false,
  conversationId: null,
  participants: new Map(),
  localStream: null,
  isMuted: false,
  isVideoOff: false,
  callDuration: 0,
  incomingCall: null,
};
