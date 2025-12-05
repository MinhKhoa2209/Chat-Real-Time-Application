"use client";
import { User } from "@prisma/client";
import Image from "next/image";

interface AvatarGroupProps {
  users?: User[] | any[];
  groupImage?: string | null;
}

const AvatarGroup: React.FC<AvatarGroupProps> = ({ users = [], groupImage }) => {
  // If group has custom image, show it instead of user avatars
  if (groupImage) {
    return (
      <div className="relative h-11 w-11">
        <div className="inline-block rounded-full overflow-hidden h-11 w-11">
          <Image
            alt="Group Avatar"
            fill
            src={groupImage}
            className="object-cover rounded-full"
          />
        </div>
      </div>
    );
  }

  // Filter out invalid users and ensure they have required fields
  const validUsers = (users || []).filter(user => user && user.id);
  const slicedUsers = validUsers.slice(0, 3);
  
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

  const positionMap = {
    0: "top-0 left-[12px]",
    1: "bottom-0",
    2: "bottom-0 right-0",
  };

  return (
    <div className="relative h-11 w-11">
      {slicedUsers.map((user, index) => (
        <div
          key={user.id || index}
          className={`absolute inline-block rounded-full overflow-hidden h-[21px] w-[21px] ${
            positionMap[index as keyof typeof positionMap]
          }`}
        >
          <Image
            alt="Avatar"
            fill
            src={user?.image || "/images/placeholder.jpg"}
            className="object-cover rounded-full"
          />
        </div>
      ))}
    </div>
  );
};

export default AvatarGroup;
