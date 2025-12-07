"use client";

import { useCall } from "@/app/context/CallContext";
import { Dialog, Transition, TransitionChild, DialogPanel } from "@headlessui/react";
import { Fragment, useEffect, useRef } from "react";
import { HiPhone, HiVideoCamera } from "react-icons/hi2";
import Image from "next/image";

const CallingModal = () => {
  const { isCalling, callType, remoteUser, endCall } = useCall();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play calling sound
  useEffect(() => {
    if (isCalling) {
      try {
        audioRef.current = new Audio("/sounds/calling.mp3");
        audioRef.current.loop = true;
        audioRef.current.play().catch(() => {
          console.log("Calling sound not available");
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
  }, [isCalling]);

  if (!remoteUser) return null;

  return (
    <Transition show={isCalling} as={Fragment}>
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
              {/* Receiver Avatar */}
              <div className="relative w-24 h-24 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-sky-500 animate-pulse" />
                <Image
                  src={remoteUser.image || "/images/placeholder.jpg"}
                  alt={remoteUser.name}
                  fill
                  className="rounded-full object-cover"
                />
              </div>

              {/* Receiver Info */}
              <h2 className="text-xl font-semibold text-white mb-1">
                {remoteUser.name}
              </h2>
              <p className="text-gray-400 mb-6 flex items-center justify-center gap-2">
                {callType === "video" ? (
                  <>
                    <HiVideoCamera className="w-5 h-5" />
                    Đang gọi video...
                  </>
                ) : (
                  <>
                    <HiPhone className="w-5 h-5" />
                    Đang gọi...
                  </>
                )}
              </p>

              {/* Cancel Button */}
              <button
                onClick={endCall}
                className="w-16 h-16 mx-auto rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all transform hover:scale-110 shadow-lg"
              >
                <HiPhone className="w-8 h-8 text-white rotate-[135deg]" />
              </button>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CallingModal;
