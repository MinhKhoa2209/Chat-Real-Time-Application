"use client";

import IncomingCallModal from "./IncomingCallModal";
import CallingModal from "./CallingModal";
import CallWindow from "./CallWindow";

const CallComponents = () => {
  return (
    <>
      <IncomingCallModal />
      <CallingModal />
      <CallWindow />
    </>
  );
};

export default CallComponents;
