import { Channel, Members } from "pusher-js";
import useActiveList from "./useActiveList";
import { useEffect, useRef, useCallback } from "react";
import { getPusherClient } from "../libs/pusher";

const useActiveChannel = () => {
  const { set, add, remove } = useActiveList();
  const channelRef = useRef<Channel | null>(null);
  const isSubscribedRef = useRef(false);

  // Memoized handlers to prevent re-binding
  const handleSubscriptionSucceeded = useCallback((members: Members) => {
    const initialMembers: string[] = [];
    members.each((member: Record<string, unknown>) => initialMembers.push(member.id as string));
    set(initialMembers);
  }, [set]);

  const handleMemberAdded = useCallback((member: Record<string, unknown>) => {
    add(member.id as string);
  }, [add]);

  const handleMemberRemoved = useCallback((member: Record<string, unknown>) => {
    remove(member.id as string);
  }, [remove]);

  useEffect(() => {
    // Prevent double subscription
    if (isSubscribedRef.current) return;

    const pusherClient = getPusherClient();
    
    // Subscribe to presence channel
    const channel = pusherClient.subscribe("presence-messenger");
    channelRef.current = channel;
    isSubscribedRef.current = true;

    // Bind events
    channel.bind("pusher:subscription_succeeded", handleSubscriptionSucceeded);
    channel.bind("pusher:member_added", handleMemberAdded);
    channel.bind("pusher:member_removed", handleMemberRemoved);

    return () => {
      if (channelRef.current) {
        channelRef.current.unbind("pusher:subscription_succeeded", handleSubscriptionSucceeded);
        channelRef.current.unbind("pusher:member_added", handleMemberAdded);
        channelRef.current.unbind("pusher:member_removed", handleMemberRemoved);
        getPusherClient().unsubscribe("presence-messenger");
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
    };
  }, [handleSubscriptionSucceeded, handleMemberAdded, handleMemberRemoved]);
};

export default useActiveChannel;
