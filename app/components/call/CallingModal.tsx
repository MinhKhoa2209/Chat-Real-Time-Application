"use client";

import { useCall } from "@/app/context/CallContext";
import { Dialog, Transition, TransitionChild, DialogPanel } from "@headlessui/react";
import { Fragment, useEffect, useRef, memo, useCallback } from "react";
import { HiPhone, HiVideoCamera } from "react-icons/hi2";
import Image from "next/image";

const CallingModal = memo(() => {
  const { status, callType, callingParticipants, isGroup, endCall } = useCall();
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCalling = status === "ringing" && callingParticipants.length > 0;

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

  // Play calling tone
  useEffect(() => {
    if (!isCalling) {
      cleanupAudio();
      return;
    }

    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);
      gainNode.gain.value = 0.2;

      const playTone = () => {
        if (!audioContextRef.current || audioContextRef.current.state === "closed") return;
        
        try {
          const oscillator = audioContextRef.current.createOscillator();
          oscillator.connect(gainNode);
          oscillator.frequency.value = 480;
          oscillator.type = "sine";
          oscillator.start();
          setTimeout(() => {
            try { oscillator.stop(); } catch {}
          }, 400);
        } catch {}
      };

      playTone();
      intervalRef.current = setInterval(playTone, 2000);
    } catch (error) {
      console.log("[CallingModal] Audio not supported", error);
    }

    return cleanupAudio;
  }, [isCalling, cleanupAudio]);

  const handleEndCall = useCallback(() => {
    cleanupAudio();
    endCall();
  }, [endCall, cleanupAudio]);

  const firstParticipant = callingParticipants[0];

  if (!isCalling) return null;

  return (
    <Transition show={isCalling} as={Fragment}>
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
                <div className="absolute inset-0 rounded-full border-4 border-sky-500 animate-pulse" />
                <Image
                  src={firstParticipant?.image || "/images/placeholder.webp"}
                  alt={firstParticipant?.name || "User"}
                  fill
                  sizes="96px"
                  className="rounded-full object-cover"
                  loading="eager"
                />
              </div>

              {/* Info */}
              <h2 className="text-xl font-semibold text-white mb-1">
                {isGroup ? "Calling group..." : firstParticipant?.name || "Calling..."}
              </h2>
              <p className="text-gray-400 mb-6 flex items-center justify-center gap-2">
                {callType === "video" ? (
                  <>
                    <HiVideoCamera className="w-5 h-5" />
                    Video calling...
                  </>
                ) : (
                  <>
                    <HiPhone className="w-5 h-5" />
                    Calling...
                  </>
                )}
              </p>

              {/* Cancel Button */}
              <button
                onClick={handleEndCall}
                className="w-16 h-16 mx-auto rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all transform hover:scale-110 shadow-lg active:scale-95"
                aria-label="Cancel call"
              >
                <HiPhone className="w-8 h-8 text-white rotate-[135deg]" />
              </button>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
});

CallingModal.displayName = "CallingModal";

export default CallingModal;
