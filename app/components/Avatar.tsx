"use client";

import { User } from "@prisma/client";
import { PartialUser } from "@/app/types";
import Image from "next/image";
import useActiveList from "../hooks/useActiveList";
import { memo, useMemo } from "react";

interface AvatarProps {
  user?: User | PartialUser;
}

const Avatar: React.FC<AvatarProps> = ({ user }) => {
  const { members } = useActiveList();

  const isActive = useMemo(() => {
    if (!user?.email) return false;
    // Gemini bot is always active
    if (user.email === "gemini@messenger.com") return true;
    return members.includes(user.email);
  }, [user?.email, members]);

  const imageSrc = user?.image || "/images/placeholder.webp";

  return (
    <div className="relative">
      <div className="relative inline-block rounded-full overflow-hidden h-9 w-9 md:h-11 md:w-11">
        <Image
          alt="Avatar"
          src={imageSrc}
          fill
          sizes="44px"
          className="object-cover"
          loading="lazy"
        />
      </div>
      {isActive && (
        <span className="absolute block rounded-full bg-green-500 ring-2 ring-white top-0 right-0 h-2 w-2 md:h-3 md:w-3" />
      )}
    </div>
  );
};

export default memo(Avatar);
