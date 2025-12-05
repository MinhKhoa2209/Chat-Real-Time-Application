"use client";

import Avatar from "@/app/components/Avatar";
import useOtherUser from "@/app/hooks/useOtherUser";
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { Conversation, User } from "@prisma/client";
import { format } from "date-fns";
import { Fragment, useMemo, useState, useEffect } from "react";
import { IoClose, IoTrash } from "react-icons/io5";
import { HiUserAdd, HiLogout } from "react-icons/hi";
import ConfirmModal from "./ConfirmModal";
import AddMembersModal from "./AddMembersModal";
import AvatarGroup from "@/app/components/AvatarGroup";
import useActiveList from "@/app/hooks/useActiveList";
import axios from "axios";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { pusherClient } from "@/app/libs/pusher";
import { useSession } from "next-auth/react";

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: Conversation & {
    users: User[];
    image?: string | null;
  };
}

const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  isOpen,
  onClose,
  data: initialData,
}) => {
  const [data, setData] = useState(initialData);
  const otherUser = useOtherUser(data);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [groupName, setGroupName] = useState(data.name || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const { members } = useActiveList();
  const router = useRouter();
  const session = useSession();

  // Update data when initialData changes
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Update groupName when data.name changes
  useEffect(() => {
    setGroupName(data.name || "");
  }, [data.name]);

  // Listen for conversation updates via user channel
  useEffect(() => {
    const email = session.data?.user?.email;
    if (!email) return;

    console.log("ProfileDrawer: Setting up listener for channel:", email);
    
    // Subscribe to channel (will reuse existing if already subscribed)
    const channel = pusherClient.subscribe(email);

    const updateHandler = async (updatedConversation: any) => {
      console.log("ProfileDrawer: Received update event");
      console.log("ProfileDrawer: Full data keys:", Object.keys(updatedConversation || {}));
      console.log("ProfileDrawer: Comparing IDs:", updatedConversation?.id, "vs", data.id);
      
      if (updatedConversation && updatedConversation.id === data.id) {
        console.log("ProfileDrawer: MATCH! Users array length:", updatedConversation.users?.length);
        
        // If imageUpdated flag is set, refetch to get the new image
        if (updatedConversation.imageUpdated) {
          console.log("ProfileDrawer: Image was updated, refetching...");
          try {
            const response = await axios.get(`/api/conversations/${data.id}`);
            const freshData = response.data;
            setData((current) => ({
              ...current,
              ...freshData,
            }));
            return;
          } catch (error) {
            console.error("Failed to refetch conversation:", error);
          }
        }
        
        setData((current) => {
          const newData = {
            ...current,
            ...updatedConversation,
            users: updatedConversation.users || current.users,
            name: updatedConversation.name ?? current.name,
            image: updatedConversation.image ?? current.image,
          };
          console.log("ProfileDrawer: New data users count:", newData.users?.length);
          return newData;
        });
        // Also update groupName if name changed
        if (updatedConversation.name) {
          setGroupName(updatedConversation.name);
        }
      }
    };

    channel.bind("conversation:update", updateHandler);

    return () => {
      channel.unbind("conversation:update", updateHandler);
    };
  }, [data.id, session.data?.user?.email]);

  const isGeminiBot = useMemo(() => {
    return otherUser?.email === 'gemini@messenger.com';
  }, [otherUser?.email]);

  const isRealUserActive = otherUser?.email ? members.indexOf(otherUser.email) !== -1 : false;
  const isActive = isGeminiBot || isRealUserActive; 

  const joinedDate = useMemo(() => {
    if (!otherUser?.createdAt) return "";
    try {
      return format(new Date(otherUser.createdAt), "PP");
    } catch {
      return "";
    }
  }, [otherUser?.createdAt]);

  const title = useMemo(() => {
    return data.name || otherUser?.name || "Conversation";
  }, [data.name, otherUser?.name]);

  const statusText = useMemo(() => {
    if (data.isGroup) {
      return `${data.users.length} members`;
    }
    if (isGeminiBot) {
        return "Active";
    }
    return isActive ? "Active" : "Offline";
  }, [data, isGeminiBot, isActive]);

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const handleLeaveGroup = async () => {
    if (isLeaving) return;
    
    setIsLeaving(true);
    try {
      await axios.post(`/api/conversations/${data.id}/leave`);
      toast.success("Left group successfully");
      router.push("/conversations");
      onClose();
    } catch (error) {
      toast.error("Failed to leave group");
    } finally {
      setIsLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  const handleUpdateGroupName = async () => {
    if (!groupName.trim() || groupName === data.name) {
      setIsEditingName(false);
      return;
    }

    setIsUpdating(true);
    try {
      await axios.put(`/api/conversations/${data.id}`, { name: groupName });
      toast.success("Group name updated");
      setIsEditingName(false);
    } catch (error) {
      toast.error("Failed to update group name");
      setGroupName(data.name || "");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setIsUpdating(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        await axios.put(`/api/conversations/${data.id}`, { image: base64 });
        toast.success("Group avatar updated");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("Failed to update group avatar");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
      />
      
      {/* Leave Group Confirm Dialog */}
      <Transition show={showLeaveConfirm} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setShowLeaveConfirm(false)}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50" />
          </TransitionChild>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Leave Group</h3>
                <p className="text-sm text-gray-500 mb-4">Are you sure you want to leave this group?</p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowLeaveConfirm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLeaveGroup}
                    disabled={isLeaving}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50"
                  >
                    {isLeaving ? "Leaving..." : "Leave"}
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>

      <AddMembersModal
        isOpen={addMembersOpen}
        onClose={() => setAddMembersOpen(false)}
        conversationId={data.id}
        currentMembers={data.users}
      />

      <Transition show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-500"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-500"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" />
          </TransitionChild>
          <div className="fixed inset-0 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                <TransitionChild
                  as={Fragment}
                  enter="transform transition ease-in-out duration-500"
                  enterFrom="translate-x-full"
                  enterTo="translate-x-0"
                  leave="transform transition ease-in-out duration-500"
                  leaveTo="translate-x-full"
                >
                  <DialogPanel className="pointer-events-auto w-screen max-w-md">
                    <div className="flex h-full flex-col overflow-y-scroll py-6 bg-white shadow-xl">
                      <div className="px-4 sm:px-6">
                        <div className="flex items-start justify-end">
                          <div className="ml-3 flex h-7 items-center">
                            <button
                              onClick={onClose}
                              type="button"
                              className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
                            >
                              <span className="sr-only">Close panel</span>
                              <IoClose size={24} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className=" relative mt-6 flex-1 px-4 sm:px-6  ">
                        <div className="flex flex-col items-center">
                          <div className="mb-2 relative group">
                            {data.isGroup ? (
                              <>
                                <AvatarGroup users={data.users} groupImage={data.image} />
                                <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition cursor-pointer">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageUpload}
                                    disabled={isUpdating}
                                  />
                                  <span className="text-white text-xs font-medium">
                                    {isUpdating ? "Uploading..." : "Change"}
                                  </span>
                                </label>
                              </>
                            ) : (
                              <Avatar user={otherUser} /> 
                            )}
                          </div>
                          
                          {data.isGroup && isEditingName ? (
                            <div className="flex items-center gap-2 mb-2">
                              <input
                                type="text"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleUpdateGroupName();
                                  if (e.key === "Escape") {
                                    setIsEditingName(false);
                                    setGroupName(data.name || "");
                                  }
                                }}
                              />
                              <button
                                onClick={handleUpdateGroupName}
                                disabled={isUpdating}
                                className="px-3 py-1 bg-sky-500 text-white text-xs rounded-lg hover:bg-sky-600 disabled:opacity-50"
                              >
                                {isUpdating ? "..." : "Save"}
                              </button>
                            </div>
                          ) : (
                            <div 
                              className={data.isGroup ? "cursor-pointer hover:text-sky-600 transition" : ""}
                              onClick={() => data.isGroup && setIsEditingName(true)}
                            >
                              {title}
                            </div>
                          )}
                          
                          <div className="text-sm text-gray-500">
                            {statusText}
                          </div>
                          <div className="flex gap-10 my-8">
                            {data.isGroup && (
                              <>
                                <div
                                  onClick={() => setAddMembersOpen(true)}
                                  className="flex flex-col gap-3 items-center cursor-pointer hover:opacity-75"
                                >
                                  <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center">
                                    <HiUserAdd size={20} />
                                  </div>
                                  <div className="text-sm font-light text-neutral-600">
                                    Add
                                  </div>
                                </div>
                                <div
                                  onClick={() => setShowLeaveConfirm(true)}
                                  className="flex flex-col gap-3 items-center cursor-pointer hover:opacity-75"
                                >
                                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                    <HiLogout size={20} className="text-red-600" />
                                  </div>
                                  <div className="text-sm font-light text-red-600">
                                    {isLeaving ? "Leaving..." : "Leave"}
                                  </div>
                                </div>
                              </>
                            )}
                            <div
                              onClick={() => setConfirmOpen(true)}
                              className="flex flex-col gap-3 items-center cursor-pointer hover:opacity-75"
                            >
                              <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center">
                                <IoTrash size={20} />
                              </div>
                              <div className="text-sm font-light text-neutral-600">
                                Delete
                              </div>
                            </div>
                          </div>
                          <div className="w-full pb-5 pt-5 sm:px-0 sm:pt-0">
                            <dl className="space-y-8 px-4 sm:space-y-6 sm:px-6">
                              {data.isGroup && (
                                <div>
                                  <dt className="text-sm font-medium text-gray-500 sm:w-40 sm:shrink-0 mb-3">
                                    Members
                                  </dt>
                                  <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                                    <div className="space-y-3">
                                      {data.users.map((user) => (
                                        <div key={user.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition">
                                          <Avatar user={user} />
                                          <div className="flex-1">
                                            <div className="font-medium">{user.name}</div>
                                            <div className="text-xs text-gray-500">{user.email}</div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </dd>
                                </div>
                              )}
                              {!data.isGroup && otherUser?.email && (
                                <div>
                                  <dt className="text-sm font-medium text-gray-500 sm:w-40 sm:shrink-0">
                                    Email
                                  </dt>
                                  <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                                    {otherUser.email}
                                  </dd>
                                </div>
                              )}
                              {!data.isGroup && !isGeminiBot && joinedDate && (
                                <>
                                  <hr />
                                  <div>
                                    <dt className="text-sm font-medium text-gray-500 sm:w-40 sm:shrink-0">
                                      Joined
                                    </dt>
                                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                                      <time dateTime={joinedDate}>
                                        {joinedDate}
                                      </time>
                                    </dd>
                                  </div>
                                </>
                              )}

                              {!data.isGroup && isGeminiBot && (
                                <>
                                  <hr />
                                  <div>
                                    <dt className="text-sm font-medium text-gray-500 sm:w-40 sm:shrink-0">
                                      Role
                                    </dt>
                                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                                      Trợ lý AI Gemini 
                                    </dd>
                                  </div>
                                </>
                              )}
                            </dl>
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogPanel>
                </TransitionChild>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default ProfileDrawer;
