// WebRTC Configuration with free STUN servers
export const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    // Free TURN servers (limited but useful for testing)
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
  ],
  iceCandidatePoolSize: 10,
};

// Media constraints
export const getMediaConstraints = (isVideo: boolean): MediaStreamConstraints => ({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: isVideo
    ? {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        facingMode: "user",
      }
    : false,
});

// Helper to check media permissions
export const checkMediaPermissions = async (
  isVideo: boolean
): Promise<{ audio: boolean; video: boolean }> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: isVideo,
    });
    stream.getTracks().forEach((track) => track.stop());
    return { audio: true, video: isVideo };
  } catch {
    return { audio: false, video: false };
  }
};
