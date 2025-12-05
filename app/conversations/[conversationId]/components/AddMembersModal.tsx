"use client";

import Modal from "@/app/components/Modal";
import { User } from "@prisma/client";
import axios from "axios";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface AddMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  currentMembers: User[];
}

const AddMembersModal: React.FC<AddMembersModalProps> = ({
  isOpen,
  onClose,
  conversationId,
  currentMembers,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Fetch fresh conversation data to get latest members
      Promise.all([
        axios.get("/api/users"),
        axios.get(`/api/conversations/${conversationId}`)
      ])
        .then(([usersRes, conversationRes]) => {
          // Get current member IDs from fresh conversation data
          const conversationUsers = conversationRes.data?.users || [];
          const currentMemberIds = conversationUsers.length > 0
            ? conversationUsers.map((m: any) => m.id)
            : currentMembers.map(m => m.id);
          
          // Filter out current members
          const availableUsers = (usersRes.data || []).filter(
            (user: User) => !currentMemberIds.includes(user.id)
          );
          setUsers(availableUsers);
        })
        .catch((error) => {
          console.error("Failed to load users:", error);
          toast.error("Failed to load users");
        });
    }
  }, [isOpen, conversationId, currentMembers]);

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (selectedUsers.length === 0) {
      toast.error("Please select at least one user");
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(`/api/conversations/${conversationId}/addMembers`, {
        memberIds: selectedUsers,
      });
      toast.success("Members added successfully");
      setSelectedUsers([]);
      onClose();
    } catch (error) {
      toast.error("Failed to add members");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Add Members
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Select users to add to this group
          </p>
        </div>

        <div className="max-h-96 overflow-y-auto space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              onClick={() => toggleUser(user.id)}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                selectedUsers.includes(user.id)
                  ? "bg-sky-100 border-2 border-sky-500"
                  : "bg-white border-2 border-gray-200 hover:border-gray-300"
              }`}
            >
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name || ""}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white font-semibold">
                  {user.name?.[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              {selectedUsers.includes(user.id) && (
                <div className="w-5 h-5 bg-sky-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || selectedUsers.length === 0}
            className="px-4 py-2 text-sm font-medium bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Adding..." : `Add (${selectedUsers.length})`}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AddMembersModal;
