"use client";

import React, { useState } from "react";
import useRoutes from "@/app/hooks/useRoutes";
import DesktopItem from "./DesktopItem";
import { User } from "@prisma/client";
import Avatar from "../Avatar";
import SettingsModal from "./SettingModal";

interface DesktopSidebarProps {
  currentUser: User;
}

const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ currentUser }) => {
  const routes = useRoutes();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <SettingsModal isOpen={isOpen} onClose={() => setIsOpen(false)} currentUser={currentUser}/>
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-20 lg:flex lg:flex-col justify-between sidebar-modern">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 mt-2">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg dark:shadow-sky-500/20">
            <span className="text-white font-bold text-lg">K</span>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 flex flex-col items-center py-4">
          <ul role="list" className="flex flex-col items-center space-y-2 w-full px-3">
            {routes.map((item) => (
              <DesktopItem
                key={item.label}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={item.active}
                onClick={item.onClick}
              />
            ))}
          </ul>
        </nav>
        
        {/* User Avatar */}
        <nav className="pb-6 flex flex-col items-center">
          <div 
            onClick={() => setIsOpen(true)} 
            className="cursor-pointer transition-all duration-300 hover:scale-110 p-1 rounded-full hover:ring-2 hover:ring-sky-400/50"
          >
            <Avatar user={currentUser}/>
          </div>
        </nav>
      </div>
    </>
  );
};

export default DesktopSidebar;