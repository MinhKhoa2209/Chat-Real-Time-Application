import { Conversation, Message, User, Reaction } from "@prisma/client";

// Partial User type for list views - only essential display fields
export type PartialUser = Pick<User, "id" | "name" | "email" | "image">;

// Simplified type for replyTo - only needs sender info for display
export type ReplyToMessageType = Message & {
  sender: User;
};

export type FullMessageType = Message & {
  sender: User;
  seen: User[];
  reactions: (Reaction & { user: User })[];
  replyTo?: ReplyToMessageType | null;
  forwardedFrom?: User | null;
};

export type FullConversationType = Conversation & {
  users: User[];
  messages: FullMessageType[];
};
  