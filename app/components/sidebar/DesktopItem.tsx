"use client";

import clsx from "clsx";
import Link from "next/link";
import { IconType } from "react-icons";

interface DesktopItemProps {
  href: string;
  label: string;
  icon: IconType;
  active?: boolean;
  onClick?: () => Promise<void> | void;
}

const DesktopItem: React.FC<DesktopItemProps> = ({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}) => {
  const handleClick = () => {
    if (onClick) {
      return onClick();
    }
  };

  return (
    <li onClick={handleClick} className="w-full">
      <Link
        href={href}
        className={clsx(
          "sidebar-item group flex items-center justify-center w-full rounded-xl p-3 transition-all duration-300",
          active 
            ? "active" 
            : ""
        )}
      >
        <Icon 
          className={clsx(
            "sidebar-icon h-6 w-6 shrink-0 transition-all duration-300",
            active 
              ? "text-sky-500 dark:text-sky-400" 
              : "text-gray-600 dark:text-gray-400 group-hover:text-sky-500 dark:group-hover:text-sky-400"
          )} 
        />
        <span className="sr-only">{label}</span>
      </Link>
    </li>
  );
};

export default DesktopItem;
