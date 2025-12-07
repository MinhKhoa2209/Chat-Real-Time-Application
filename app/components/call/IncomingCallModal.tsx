"use client";

import { useCall } from "@/app/context/CallContext";
import { Dialog, Transition, TransitionChild, DialogPanel } from "@headlessui/react";
import { Fragment, useEffect, useRef } from "react";
import { HiPhone, HiVideoCamera } from "react-icons/hi2";
import { IoClose } from "react-icons/io5";
import Image from "next/image";

const IncomingCallModal = () => {
  const { isRinging, incomingCall, acceptCall, rejectCall } = useCall();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play ringtone
  useEffect(() => {
    if (isRinging) {
      try {
        audioRef.current = new Audio("/sounds/ringtone.mp3");
        audioRef.current.loop = true;
        audioRef.current.play().catch(() => {
          // Fallback: use browser notification sound or silent
          console.log("Ringtone not available");
        });
      } catch {
        console.log("Audio not supported");
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isRinging]);

  if (!incomingCall) return null;

  return (
    <Transition show={isRinging} as={Fragment}>
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
          <div className="fixed inset-0 bg-black/70" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
              {/* Caller Avatar */}
              <div className="relative w-24 h-24 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full bg-sky-500 animate-ping opacity-25" />
                <Image
                  src={incomingCall.callerImage || "/images/placeholder.jpg"}
                  alt={incomingCall.callerName}
                  fill
                  className="rounded-full object-cover border-4 border-white"
                />
              </div>

              {/* Caller Info */}
              <h2 className="text-xl font-semibold text-white mb-1">
                {incomingCall.callerName}
              </h2>
              <p className="text-gray-400 mb-6 flex items-center justify-center gap-2">
                {incomingCall.callType === "video" ? (
                  <>
                    <HiVideoCamera className="w-5 h-5" />
                    Cuộc gọi video đến...
                  </>
                ) : (
                  <>
                    <HiPhone className="w-5 h-5" />
                    Cuộc gọi thoại đến...
                  </>
                )}
              </p>

              {/* Action Buttons */}
              <div className="flex justify-center gap-8">
                {/* Reject Button */}
                <button
                  onClick={rejectCall}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all transform hover:scale-110 shadow-lg"
                >
                  <IoClose className="w-8 h-8 text-white" />
                </button>

                {/* Accept Button */}
                <button
                  onClick={acceptCall}
                  className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-all transform hover:scale-110 shadow-lg"
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
};

export default IncomingCallModal;
