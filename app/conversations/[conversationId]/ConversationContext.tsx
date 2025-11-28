"use client";

import { FullMessageType } from "@/app/types";
import { createContext, useContext, useState } from "react";

interface ConversationContextProps {
  replyTo: FullMessageType | null;
  setReplyTo: (msg: FullMessageType | null) => void;
}

const ConversationContext = createContext<ConversationContextProps>({
  replyTo: null,
  setReplyTo: () => {},
});

export const ConversationProvider = ({ children }: { children: React.ReactNode }) => {
  const [replyTo, setReplyTo] = useState<FullMessageType | null>(null);
  return (
    <ConversationContext.Provider value={{ replyTo, setReplyTo }}>
      {children}
    </ConversationContext.Provider>
  );
};

export const useConversationContext = () => useContext(ConversationContext);