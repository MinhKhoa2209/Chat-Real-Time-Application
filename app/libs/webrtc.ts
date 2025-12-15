// WebRTC Configuration - Optimized for faster connection
export const rtcConfig: RTCConfiguration = {
  iceServers: [
    // Google STUN servers (fastest, most reliable)
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // Free TURN servers for NAT traversal
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  // Optimized ICE settings
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
  // Use all available ICE candidates for faster connection
  iceTransportPolicy: "all",
};

// Optimized media constraints for getUserMedia
export const getMediaConstraints = (isVideo: boolean): MediaStreamConstraints => ({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    // Optimized audio settings
    sampleRate: 48000,
    channelCount: 1, // Mono for voice calls (less bandwidth)
  },
  video: isVideo
    ? {
        // Adaptive resolution based on network
        width: { ideal: 1280, min: 640, max: 1920 },
        height: { ideal: 720, min: 480, max: 1080 },
        frameRate: { ideal: 30, min: 15, max: 30 },
        facingMode: "user",
      }
    : false,
});

// Logger for WebRTC events (disabled in production)
const DEBUG = process.env.NODE_ENV === "development";
export const rtcLogger = {
  log: (context: string, message: string, data?: unknown) => {
    if (DEBUG) console.log(`[WebRTC:${context}] ${message}`, data || "");
  },
  error: (context: string, message: string, error?: unknown) => {
    console.error(`[WebRTC:${context}] ERROR: ${message}`, error || "");
  },
  warn: (context: string, message: string, data?: unknown) => {
    if (DEBUG) console.warn(`[WebRTC:${context}] WARN: ${message}`, data || "");
  },
};

// Create and configure peer connection with optimized settings
export const createPeerConnection = (
  onIceCandidate: (candidate: RTCIceCandidate) => void,
  onTrack: (stream: MediaStream) => void,
  onConnectionStateChange: (state: RTCPeerConnectionState) => void,
  onIceConnectionStateChange: (state: RTCIceConnectionState) => void
): RTCPeerConnection => {
  const pc = new RTCPeerConnection(rtcConfig);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      rtcLogger.log("ICE", "New ICE candidate", event.candidate.candidate);
      onIceCandidate(event.candidate);
    }
  };

  pc.ontrack = (event) => {
    rtcLogger.log("Track", "Received remote track", event.track.kind);
    if (event.streams[0]) {
      onTrack(event.streams[0]);
    }
  };

  pc.onconnectionstatechange = () => {
    rtcLogger.log("Connection", "State changed", pc.connectionState);
    onConnectionStateChange(pc.connectionState);
  };

  pc.oniceconnectionstatechange = () => {
    rtcLogger.log("ICE", "Connection state changed", pc.iceConnectionState);
    onIceConnectionStateChange(pc.iceConnectionState);
    
    // Auto restart ICE on failure
    if (pc.iceConnectionState === "failed") {
      rtcLogger.warn("ICE", "Connection failed, attempting restart");
      pc.restartIce();
    }
  };

  pc.onicegatheringstatechange = () => {
    rtcLogger.log("ICE", "Gathering state", pc.iceGatheringState);
  };

  pc.onsignalingstatechange = () => {
    rtcLogger.log("Signaling", "State changed", pc.signalingState);
  };

  return pc;
};

// Add local stream to peer connection with optimized track handling
export const addStreamToPeerConnection = (
  pc: RTCPeerConnection,
  stream: MediaStream
): void => {
  stream.getTracks().forEach((track) => {
    rtcLogger.log("Track", `Adding ${track.kind} track to peer connection`);
    const sender = pc.addTrack(track, stream);
    
    // Set encoding parameters for video tracks
    if (track.kind === "video" && sender) {
      const params = sender.getParameters();
      if (params.encodings && params.encodings.length > 0) {
        // Optimize video encoding
        params.encodings[0].maxBitrate = 1500000; // 1.5 Mbps max
        params.encodings[0].scaleResolutionDownBy = 1;
        sender.setParameters(params).catch(() => {});
      }
    }
  });
};

// Get local media stream with fallback
export const getLocalStream = async (isVideo: boolean): Promise<MediaStream> => {
  rtcLogger.log("Media", `Requesting ${isVideo ? "video" : "audio"} stream`);

  try {
    const stream = await navigator.mediaDevices.getUserMedia(
      getMediaConstraints(isVideo)
    );
    rtcLogger.log("Media", "Got local stream", {
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length,
    });
    return stream;
  } catch (error) {
    rtcLogger.error("Media", "Failed to get local stream", error);
    
    // Fallback: try audio only if video fails
    if (isVideo) {
      rtcLogger.warn("Media", "Falling back to audio only");
      try {
        return await navigator.mediaDevices.getUserMedia(getMediaConstraints(false));
      } catch (audioError) {
        rtcLogger.error("Media", "Audio fallback also failed", audioError);
        throw audioError;
      }
    }
    throw error;
  }
};

// Stop all tracks in a stream efficiently
export const stopStream = (stream: MediaStream | null): void => {
  if (!stream) return;
  
  stream.getTracks().forEach((track) => {
    rtcLogger.log("Media", `Stopping ${track.kind} track`);
    track.stop();
  });
};

// Toggle audio track - returns new muted state
export const toggleAudio = (stream: MediaStream | null): boolean => {
  if (!stream) return false;
  
  const audioTrack = stream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    rtcLogger.log("Media", `Audio ${audioTrack.enabled ? "enabled" : "disabled"}`);
    return !audioTrack.enabled; // Return muted state
  }
  return false;
};

// Toggle video track - returns new video off state
export const toggleVideo = (stream: MediaStream | null): boolean => {
  if (!stream) return false;
  
  const videoTrack = stream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    rtcLogger.log("Media", `Video ${videoTrack.enabled ? "enabled" : "disabled"}`);
    return !videoTrack.enabled; // Return video off state
  }
  return false;
};

// Check if browser supports WebRTC
export const isWebRTCSupported = (): boolean => {
  return !!(
    typeof window !== "undefined" &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    window.RTCPeerConnection
  );
};

// Get available media devices
export const getMediaDevices = async (): Promise<{
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
}> => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    audioInputs: devices.filter((d) => d.kind === "audioinput"),
    videoInputs: devices.filter((d) => d.kind === "videoinput"),
    audioOutputs: devices.filter((d) => d.kind === "audiooutput"),
  };
};
