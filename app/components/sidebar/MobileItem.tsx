"use client";

import clsx from "clsx";
import Link from "next/link";
import { IconType } from "react-icons";

interface MobileItemProps {
    href: string;
    icon: IconType,
    active?: boolean;
    onClick?: () => Promise<void> | void;
}

const MobileItem: React.FC<MobileItemProps> = ({href, icon: Icon, active, onClick}) => {
    const handleClick = () => {
        if(onClick) {
            return onClick();
        }
    };
    return (
        <Link 
            href={href} 
            onClick={handleClick} 
            className={clsx(
                "group flex items-center justify-center p-3 rounded-xl transition-all duration-300",
                active 
                    ? "gradient-primary text-white shadow-lg" 
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
        >
            <Icon className={clsx(
                "h-6 w-6 transition-transform duration-300",
                active && "scale-110"
            )}/>
        </Link>
    )
};

export default MobileItem;
