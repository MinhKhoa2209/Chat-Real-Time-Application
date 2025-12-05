import { useSession } from "next-auth/react";
import { useMemo } from "react";
import { FullConversationType } from "../types";
import { User } from "@prisma/client";

const useOtherUser = (
  conversation:
    | FullConversationType
    | {
        users: User[];
      }
) => {
  const session = useSession();

  const otherUser = useMemo(() => {
    const currentUserEmail = session?.data?.user?.email;
    const users = conversation?.users || [];

    const otherUsers = users.filter(
      (user) => user?.email !== currentUserEmail
    );
    return otherUsers[0] || {} as User;
  }, [session?.data?.user?.email, conversation?.users]);
  
  return otherUser;
};

export default useOtherUser;
