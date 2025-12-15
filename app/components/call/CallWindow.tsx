"use client";

import { useCall } from "@/app/context/CallContext";
import { Dialog, Transition, TransitionChild, DialogPanel } from "@headlessui/react";
import { Fragment, useEffect, useRef, memo, useCallback, useMemo } from "react";
import { HiPhone, HiMicrophone, HiVideoCamera, HiSpeakerWave } from "react-icons/hi2";
import { BsMicMuteFill, BsCameraVideoOffFill } from "react-icons/bs";
import Image from "next/image";

// Memoized video component for remote streams
const RemoteVideo = memo(({ 
  stream, 
  participantId,
  participantName,
  participantImage,
  isFullScreen = false 
}: { 
  stream: MediaStream | null;
  participantId: string;
  participantName: string;
  participantImage?: string;
  isFullScreen?: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) {
    return (
      <div className={`${isFullScreen ? 'w-full h-full' : ''} flex items-center justify-center bg-gray-800`}>
        <div className="text-center">
          <div className="relative w-32 h-32 mx-auto mb-4">
            <Image
              src={participantImage || "/images/placeholder.webp"}
              alt={participantName}
              fill
              sizes="128px"
              className="rounded-full object-cover"
            />
          </div>
          <p className="text-white text-lg">{participantName}</p>
          <p className="text-gray-400">Connecting...</p>
        </div>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className={`${isFullScreen ? 'w-full h-full' : 'w-full h-full'} object-cover`}
    />
  );
});

RemoteVideo.displayName = "RemoteVideo";

// Memoized local video component
const LocalVideo = memo(({ 
  stream, 
  isVideoOff 
}: { 
  stream: MediaStream | null;
  isVideoOff: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream || isVideoOff) {
    return (
      <div className="w-full h-full bg-gray-800 flex items-center justify-center">
        <BsCameraVideoOffFill className="w-8 h-8 text-gray-500" />
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover mirror"
    />
  );
});

LocalVideo.displayName = "LocalVideo";

const CallWindow = memo(() => {
  const {
    status,
    callType,
    isGroup,
    localStream,
    remoteStreams,
    participants,
    isMuted,
    isVideoOff,
    callDuration,
    endCall,
    toggleMute,
    toggleVideo,
  } = useCall();

  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const isActive = status === "connecting" || status === "connected";

  // Format duration - memoized
  const formattedDuration = useMemo(() => {
    const mins = Math.floor(callDuration / 60);
    const secs = callDuration % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, [callDuration]);

  // Set remote audio for voice calls
  useEffect(() => {
    if (callType !== "voice" || !remoteAudioRef.current) return;

    const firstStream = remoteStreams.values().next().value;
    if (firstStream) {
      remoteAudioRef.current.srcObject = firstStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStreams, callType]);

  // Memoized participant list
  const participantList = useMemo(() => 
    Array.from(participants.values()), [participants]);

  const firstParticipant = participantList[0];

  // Memoized handlers
  const handleEndCall = useCallback(() => endCall(), [endCall]);
  const handleToggleMute = useCallback(() => toggleMute(), [toggleMute]);
  const handleToggleVideo = useCallback(() => toggleVideo(), [toggleVideo]);

  if (!isActive) return null;

  return (
    <Transition show={isActive} as={Fragment}>
      {/* Hidden audio element for voice calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <Dialog as="div" className="relative z-[100]" onClose={() => {}}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black" />
        </TransitionChild>

        <div className="fixed inset-0">
          <DialogPanel className="w-full h-full flex flex-col">
            {/* Video Area */}
            {callType === "video" ? (
              <div className="flex-1 relative bg-gray-900">
                {/* Remote Videos */}
                {isGroup ? (
                  // Grid layout for group video call
                  <div className="w-full h-full grid grid-cols-2 gap-1 p-1">
                    {participantList.map((participant) => (
                      <div key={participant.id} className="relative bg-gray-800 rounded-lg overflow-hidden">
                        <RemoteVideo
                          stream={participant.stream || null}
                          participantId={participant.id}
                          participantName={participant.name}
                          participantImage={participant.image}
                        />
                        <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-sm">
                          {participant.name}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Full screen for 1-1 video call
                  <RemoteVideo
                    stream={firstParticipant?.stream || null}
                    participantId={firstParticipant?.id || ""}
                    participantName={firstParticipant?.name || "User"}
                    participantImage={firstParticipant?.image}
                    isFullScreen
                  />
                )}

                {/* Local Video (PiP) */}
                <div className="absolute top-4 right-4 w-32 h-44 md:w-48 md:h-64 rounded-xl overflow-hidden shadow-lg border-2 border-white/20">
                  <LocalVideo stream={localStream} isVideoOff={isVideoOff} />
                </div>
              </div>
            ) : (
              /* Voice Call UI */
              <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-gray-800 to-gray-900">
                {isGroup ? (
                  // Group voice call
                  <div className="text-center">
                    <div className="flex justify-center gap-4 mb-6 flex-wrap">
                      {participantList.slice(0, 4).map((participant) => (
                        <div key={participant.id} className="relative">
                          <Image
                            src={participant.image || "/images/placeholder.webp"}
                            alt={participant.name}
                            width={64}
                            height={64}
                            className="rounded-full border-2 border-white/20"
                          />
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-black/50 px-2 py-0.5 rounded text-white text-xs whitespace-nowrap">
                            {participant.name.split(" ")[0]}
                          </span>
                        </div>
                      ))}
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-2">
                      Group Call
                    </h2>
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <HiSpeakerWave className="w-5 h-5 animate-pulse" />
                      <span>{formattedDuration}</span>
                    </div>
                  </div>
                ) : (
                  // 1-1 voice call
                  <div className="text-center">
                    <div className="relative w-32 h-32 mx-auto mb-4">
                      <div className="absolute inset-0 rounded-full bg-sky-500/20 animate-pulse" />
                      <Image
                        src={firstParticipant?.image || "/images/placeholder.webp"}
                        alt={firstParticipant?.name || "User"}
                        fill
                        sizes="128px"
                        className="rounded-full object-cover border-4 border-white/20"
                      />
                    </div>
                    <h2 className="text-2xl font-semibold text-white mb-2">
                      {firstParticipant?.name || "Connecting..."}
                    </h2>
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <HiSpeakerWave className="w-5 h-5 animate-pulse" />
                      <span>{formattedDuration}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Status Bar */}
            <div className="absolute top-4 left-4 bg-black/50 rounded-full px-4 py-2 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${status === "connected" ? "bg-green-500" : "bg-yellow-500"} animate-pulse`} />
              <span className="text-white text-sm">
                {status === "connected" ? formattedDuration : "Connecting..."}
              </span>
            </div>

            {/* Control Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex justify-center items-center gap-4">
                {/* Mute Button */}
                <button
                  onClick={handleToggleMute}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                    isMuted ? "bg-red-500 hover:bg-red-600" : "bg-white/20 hover:bg-white/30"
                  }`}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <BsMicMuteFill className="w-6 h-6 text-white" />
                  ) : (
                    <HiMicrophone className="w-6 h-6 text-white" />
                  )}
                </button>

                {/* End Call Button */}
                <button
                  onClick={handleEndCall}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all transform hover:scale-105 shadow-lg active:scale-95"
                  aria-label="End call"
                >
                  <HiPhone className="w-8 h-8 text-white rotate-[135deg]" />
                </button>

                {/* Video Toggle (only for video calls) */}
                {callType === "video" && (
                  <button
                    onClick={handleToggleVideo}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                      isVideoOff ? "bg-red-500 hover:bg-red-600" : "bg-white/20 hover:bg-white/30"
                    }`}
                    aria-label={isVideoOff ? "Turn on camera" : "Turn off camera"}
                  >
                    {isVideoOff ? (
                      <BsCameraVideoOffFill className="w-6 h-6 text-white" />
                    ) : (
                      <HiVideoCamera className="w-6 h-6 text-white" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </Transition>
  );
});

CallWindow.displayName = "CallWindow";

export default CallWindow;
