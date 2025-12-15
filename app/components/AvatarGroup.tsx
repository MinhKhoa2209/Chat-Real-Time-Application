"use client";

import { User } from "@prisma/client";
import Image from "next/image";
import { memo, useMemo } from "react";

interface AvatarGroupProps {
  users?: User[] | { id: string; image?: string | null }[];
  groupImage?: string | null;
}

const positionMap = {
  0: "top-0 left-[12px]",
  1: "bottom-0",
  2: "bottom-0 right-0",
} as const;

const AvatarGroup: React.FC<AvatarGroupProps> = ({ users = [], groupImage }) => {
  // If group has custom image, show it
  if (groupImage) {
    return (
      <div className="relative h-11 w-11">
        <div className="inline-block rounded-full overflow-hidden h-11 w-11">
          <Image
            alt="Group Avatar"
            fill
            sizes="44px"
            src={groupImage}
            className="object-cover rounded-full"
            loading="lazy"
          />
        </div>
      </div>
    );
  }

  // Memoize sliced users
  const slicedUsers = useMemo(() => {
    const validUsers = (users || []).filter((user) => user && user.id);
    return validUsers.slice(0, 3);
  }, [users]);

  // If no valid users, show placeholder
  if (slicedUsers.length === 0) {
    return (
      <div className="relative h-11 w-11">
        <div className="inline-block rounded-full overflow-hidden h-11 w-11 bg-gray-200 flex items-center justify-center">
          <span className="text-gray-500 text-xs">G</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-11 w-11">
      {slicedUsers.map((user, index) => (
        <div
          key={user.id}
          className={`absolute inline-block rounded-full overflow-hidden h-[21px] w-[21px] ${
            positionMap[index as keyof typeof positionMap]
          }`}
        >
          <Image
            alt="Avatar"
            fill
            sizes="21px"
            src={user?.image || "/images/placeholder.webp"}
            className="object-cover rounded-full"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
};

export default memo(AvatarGroup);
