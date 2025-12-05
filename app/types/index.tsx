import { Conversation, Message, User, Reaction } from "@prisma/client";

export type FullMessageType = Message & {
  sender: User;
  seen: User[];
  reactions: (Reaction & { user: User })[];
  replyTo?: FullMessageType | null;
  forwardedFrom?: User | null;
};

export type FullConversationType = Conversation & {
  users: User[];
  messages: FullMessageType[];
};
  