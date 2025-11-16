import { usePathname } from "next/navigation"
import useConversation from "./useConversation";
import { use, useMemo } from "react";
import { HiArrowLeft, HiChat, HiUser } from "react-icons/hi";
import { signOut } from "next-auth/react";
import { HiArrowLeftOnRectangle } from "react-icons/hi2";

const useRoutes = () => {
    const pathName = usePathname();
    const {conversationId} = useConversation();
    const routes = useMemo(() => [
        {
            label:'Chat',
            href: '/conversations',
            icon: HiChat,
            active: pathName === '/conversations' || !!conversationId

        }, 
        {
            label:'Users',
            href: '/users',
            icon: HiUser,
            active: pathName === '/users'
        },
        {
            label: 'Logout',
            href: '#',
            onClick: () => signOut(),
            icon: HiArrowLeftOnRectangle,
            
        }
    ], [pathName, conversationId]);
    return routes;
}
export default useRoutes;