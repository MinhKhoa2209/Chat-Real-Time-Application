"use client";

import dynamic from "next/dynamic";
import { useCall } from "@/app/context/CallContext";
import { memo } from "react";

// Lazy load call modals for better initial page load
const IncomingCallModal = dynamic(() => import("./IncomingCallModal"), {
  ssr: false,
  loading: () => null,
});

const CallingModal = dynamic(() => import("./CallingModal"), {
  ssr: false,
  loading: () => null,
});

const CallWindow = dynamic(() => import("./CallWindow"), {
  ssr: false,
  loading: () => null,
});

const CallComponents = memo(() => {
  const { status, incomingCall, callingParticipants } = useCall();

  // Only render components when needed
  const showIncomingModal = status === "ringing" && incomingCall !== null;
  const showCallingModal = status === "ringing" && callingParticipants.length > 0;
  const showCallWindow = status === "connecting" || status === "connected";

  return (
    <>
      {showIncomingModal && <IncomingCallModal />}
      {showCallingModal && <CallingModal />}
      {showCallWindow && <CallWindow />}
    </>
  );
});

CallComponents.displayName = "CallComponents";

export default CallComponents;
