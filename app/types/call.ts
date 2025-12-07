export type CallType = "voice" | "video";
export type CallStatus = "ringing" | "ongoing" | "ended" | "missed" | "rejected";
export type CallEndReason = "completed" | "missed" | "rejected" | "busy" | "failed";

export interface CallData {
  id: string;
  type: CallType;
  status: CallStatus;
  callerId: string;
  callerName: string;
  callerImage?: string;
  receiverId: string;
  receiverName: string;
  receiverImage?: string;
  conversationId: string;
  startedAt: Date;
}

export interface SignalingData {
  type: "offer" | "answer" | "ice-candidate" | "call-end" | "call-reject";
  callId: string;
  callerId: string;
  receiverId: string;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit | { reason: string };
}

export interface IncomingCallData {
  callId: string;
  callType: CallType;
  callerId: string;
  callerName: string;
  callerImage?: string;
  conversationId: string;
}
