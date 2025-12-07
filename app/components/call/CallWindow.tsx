"use client";

import { useCall } from "@/app/context/CallContext";
import { Dialog, Transition, TransitionChild, DialogPanel } from "@headlessui/react";
import { Fragment, useEffect, useRef } from "react";
import {
  HiPhone,
  HiMicrophone,
  HiVideoCamera,
  HiSpeakerWave,
} from "react-icons/hi2";
import { BsMicMuteFill, BsCameraVideoOffFill } from "react-icons/bs";
import Image from "next/image";

const CallWindow = () => {
  const {
    isInCall,
    callType,
    remoteUser,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    callDuration,
    endCall,
    toggleMute,
    toggleVideo,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Set local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Set remote video stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (!remoteUser) return null;

  return (
    <Transition show={isInCall} as={Fragment}>
      <Dialog as="div" className="relative z-[100]" onClose={() => {}}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
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
                {/* Remote Video (Full screen) */}
                {remoteStream ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="relative w-32 h-32 mx-auto mb-4">
                        <Image
                          src={remoteUser.image || "/images/placeholder.jpg"}
                          alt={remoteUser.name}
                          fill
                          className="rounded-full object-cover"
                        />
                      </div>
                      <p className="text-white text-lg">{remoteUser.name}</p>
                      <p className="text-gray-400">Đang kết nối...</p>
                    </div>
                  </div>
                )}

                {/* Local Video (Picture-in-picture) */}
                <div className="absolute top-4 right-4 w-32 h-44 md:w-48 md:h-64 rounded-xl overflow-hidden shadow-lg border-2 border-white/20">
                  {localStream && !isVideoOff ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover mirror"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <BsCameraVideoOffFill className="w-8 h-8 text-gray-500" />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Voice Call UI */
              <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-gray-800 to-gray-900">
                <div className="text-center">
                  <div className="relative w-32 h-32 mx-auto mb-4">
                    <div className="absolute inset-0 rounded-full bg-sky-500/20 animate-pulse" />
                    <Image
                      src={remoteUser.image || "/images/placeholder.jpg"}
                      alt={remoteUser.name}
                      fill
                      className="rounded-full object-cover border-4 border-white/20"
                    />
                  </div>
                  <h2 className="text-2xl font-semibold text-white mb-2">
                    {remoteUser.name}
                  </h2>
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <HiSpeakerWave className="w-5 h-5 animate-pulse" />
                    <span>{formatDuration(callDuration)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Call Info Bar */}
            <div className="absolute top-4 left-4 bg-black/50 rounded-full px-4 py-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-white text-sm">{formatDuration(callDuration)}</span>
            </div>

            {/* Control Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex justify-center items-center gap-4">
                {/* Mute Button */}
                <button
                  onClick={toggleMute}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    isMuted
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-white/20 hover:bg-white/30"
                  }`}
                >
                  {isMuted ? (
                    <BsMicMuteFill className="w-6 h-6 text-white" />
                  ) : (
                    <HiMicrophone className="w-6 h-6 text-white" />
                  )}
                </button>

                {/* End Call Button */}
                <button
                  onClick={endCall}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all transform hover:scale-105 shadow-lg"
                >
                  <HiPhone className="w-8 h-8 text-white rotate-[135deg]" />
                </button>

                {/* Video Toggle Button (only for video calls) */}
                {callType === "video" && (
                  <button
                    onClick={toggleVideo}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                      isVideoOff
                        ? "bg-red-500 hover:bg-red-600"
                        : "bg-white/20 hover:bg-white/30"
                    }`}
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
};

export default CallWindow;
