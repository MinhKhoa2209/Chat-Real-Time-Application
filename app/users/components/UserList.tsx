"use client";

import { PartialUser } from "@/app/types";
import UserBox from "./UserBox";

interface UserListProps {
  items: PartialUser[];
}

const UserList: React.FC<UserListProps> = ({ items }) => {
  return (
    <aside className="fixed inset-y-0 pb-20 lg:pb-0 lg:left-20 lg:w-80 lg:block block left-0 w-full border-gray-200 border-r overflow-y-auto">
      <div className="px-5">
        <div className="flex-col">
          <div className="text-2xl font-bold text-neutral-800 py-4">People</div>
        </div>
        {items.map((item) => (
            <UserBox key={item.id} data={item} />
        ))}
      </div>
    </aside>
  );
};

export default UserList;
