"use client";

import { HiOutlineChatBubbleLeftRight } from "react-icons/hi2";

const EmptyState = () => {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8 h-full w-full flex justify-center items-center bg-white dark:bg-gray-900 transition duration-500 hidden lg:flex">
      <div className="text-center items-center flex flex-col p-8 rounded-xl">
        <HiOutlineChatBubbleLeftRight className="w-16 h-16 text-pink-400 mb-4 drop-shadow-lg" />
        <h3 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white tracking-wide">
          Select a conversation
        </h3>
        <p className="mt-2 text-md text-gray-500 dark:text-gray-400">Or start a new chat.</p>
      </div>
    </div>
  );
};

export default EmptyState;