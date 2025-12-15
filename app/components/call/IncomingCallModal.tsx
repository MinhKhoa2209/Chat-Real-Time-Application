"use client";

import { useCall } from "@/app/context/CallContext";
import { Dialog, Transition, TransitionChild, DialogPanel } from "@headlessui/react";
import { Fragment, useEffect, useRef, memo, useCallback } from "react";
import { HiPhone, HiVideoCamera } from "react-icons/hi2";
import { IoClose } from "react-icons/io5";
import Image from "next/image";

const IncomingCallModal = memo(() => {
  const { status, incomingCall, acceptCall, rejectCall } = useCall();
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRinging = status === "ringing" && incomingCall !== null;

  // Cleanup audio function
  const cleanupAudio = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  // Play ringtone using Web Audio API
  useEffect(() => {
    if (!isRinging) {
      cleanupAudio();
      return;
    }

    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);
      gainNode.gain.value = 0.3;

      const playBeep = () => {
        if (!audioContextRef.current || audioContextRef.current.state === "closed") return;
        
        try {
          const oscillator = audioContextRef.current.createOscillator();
          oscillator.connect(gainNode);
          oscillator.frequency.value = 440;
          oscillator.type = "sine";
          oscillator.start();
          setTimeout(() => {
            try { oscillator.stop(); } catch {}
          }, 200);
        } catch {}
      };

      playBeep();
      intervalRef.current = setInterval(playBeep, 1000);
    } catch (error) {
      console.log("[IncomingCallModal] Audio not supported", error);
    }

    return cleanupAudio;
  }, [isRinging, cleanupAudio]);

  const handleAccept = useCallback(() => {
    cleanupAudio();
    acceptCall();
  }, [acceptCall, cleanupAudio]);

  const handleReject = useCallback(() => {
    cleanupAudio();
    rejectCall();
  }, [rejectCall, cleanupAudio]);

  if (!incomingCall) return null;

  const displayName = incomingCall.isGroup
    ? incomingCall.groupName || "Group"
    : incomingCall.callerName;

  return (
    <Transition show={isRinging} as={Fragment}>
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
          <div className="fixed inset-0 bg-black/70" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
              {/* Avatar */}
              <div className="relative w-24 h-24 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full bg-sky-500 animate-ping opacity-25" />
                <Image
                  src={incomingCall.callerImage || "/images/placeholder.webp"}
                  alt={displayName}
                  fill
                  sizes="96px"
                  className="rounded-full object-cover border-4 border-white"
                  loading="eager"
                />
              </div>

              {/* Info */}
              <h2 className="text-xl font-semibold text-white mb-1">
                {displayName}
              </h2>
              <p className="text-gray-400 mb-6 flex items-center justify-center gap-2">
                {incomingCall.callType === "video" ? (
                  <>
                    <HiVideoCamera className="w-5 h-5" />
                    {incomingCall.isGroup ? "Incoming group video call..." : "Incoming video call..."}
                  </>
                ) : (
                  <>
                    <HiPhone className="w-5 h-5" />
                    {incomingCall.isGroup ? "Incoming group voice call..." : "Incoming voice call..."}
                  </>
                )}
              </p>

              {/* Actions */}
              <div className="flex justify-center gap-8">
                <button
                  onClick={handleReject}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all transform hover:scale-110 shadow-lg active:scale-95"
                  aria-label="Reject call"
                >
                  <IoClose className="w-8 h-8 text-white" />
                </button>

                <button
                  onClick={handleAccept}
                  className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-all transform hover:scale-110 shadow-lg active:scale-95"
                  aria-label="Accept call"
                >
                  {incomingCall.callType === "video" ? (
                    <HiVideoCamera className="w-8 h-8 text-white" />
                  ) : (
                    <HiPhone className="w-8 h-8 text-white" />
                  )}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
});

IncomingCallModal.displayName = "IncomingCallModal";

export default IncomingCallModal;
