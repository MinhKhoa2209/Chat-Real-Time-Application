"use client";

import { PartialUser } from "@/app/types";
import UserBox from "./UserBox";

interface UserListProps {
  items: PartialUser[];
}

const UserList: React.FC<UserListProps> = ({ items }) => {
  return (
    <aside className="fixed inset-y-0 pb-20 lg:pb-0 lg:left-20 lg:w-80 lg:block block left-0 w-full border-r border-gray-200 dark:border-gray-800 overflow-y-auto bg-white dark:bg-gray-900">
      <div className="px-5">
        <div className="flex-col">
          <div className="text-2xl font-bold text-gray-900 dark:text-white py-4">People</div>
        </div>
        {items.map((item) => (
            <UserBox key={item.id} data={item} />
        ))}
      </div>
    </aside>
  );
};

export default UserList;
