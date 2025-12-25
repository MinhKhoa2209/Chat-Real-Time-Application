"use client";

import useConversation from "@/app/hooks/useConversation";
import useRoutes from "@/app/hooks/useRoutes";
import MobileItem from "./MobileItem";

const MobileFooter = () => {
    const routes = useRoutes();
    const {isOpen} = useConversation();

    if(isOpen) {
        return null;
    }
    return (
        <div className="fixed flex justify-around w-full bottom-0 z-40 items-center glass border-t border-gray-200/50 dark:border-gray-700/50 lg:hidden py-2 px-4">
            {routes.map((route) => (
                <MobileItem 
                    key={route.href}
                    href={route.href}
                    icon={route.icon}
                    active={route.active}
                    onClick={route.onClick}
                />
            ))}
        </div>
    );
};

export default MobileFooter;