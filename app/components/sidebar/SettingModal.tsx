"use client";

import { User } from "@prisma/client";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import Modal from "../Modal";
import Input from "../inputs/Input";
import Image from "next/image";
import { CldUploadButton } from "next-cloudinary";
import Button from "../Button";
import { useTheme } from "@/app/context/ThemeContext";
import { HiSun, HiMoon } from "react-icons/hi2";

interface SettingsModalProps {
  isOpen?: boolean;
  onClose: () => void;
  currentUser: User;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FieldValues>({
    defaultValues: {
      name: currentUser?.name,
      image: currentUser?.image,
    },
  });
  const image = watch("image");

  const handleUpload = (result: any) => {
    setValue("image", result?.info?.secure_url, {
      shouldValidate: true,
    });
  };
  const onSubmit: SubmitHandler<FieldValues> = (data) => {
    setIsLoading(true);

    axios
      .post("/api/settings", data)
      .then(() => {
        router.refresh();
        onClose();
      })
      .catch(() => toast.error("Something went wrong!"))
      .finally(() => setIsLoading(false));
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-8">
          <div className="border-b border-gray-200 dark:border-gray-700 pb-8">
            <h2 className="text-xl font-semibold leading-7 text-gray-900 dark:text-white">
              Profile
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
              Edit your public information.
            </p>
            <div className="mt-8 flex flex-col gap-y-6">
              <Input
                disabled={isLoading}
                label="Name"
                id="name"
                errors={errors}
                required
                register={register}
              />
              <div>
                <label className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100 mb-2">
                  Photo
                </label>
                <div className="flex items-center gap-x-4">
                  <div className="relative h-14 w-14 rounded-full overflow-hidden ring-2 ring-gray-200 dark:ring-gray-700">
                    <Image
                      fill
                      className="object-cover"
                      src={image || currentUser?.image || "/images/placeholder.webp"}
                      alt="Avatar"
                    />
                  </div>
                  <CldUploadButton
                    options={{ maxFiles: 1 }}
                    onSuccess={handleUpload}
                    uploadPreset="nxq0q7mq"
                  >
                    <div className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 text-gray-700 dark:text-gray-300">
                      Change
                    </div>
                  </CldUploadButton>
                </div>
              </div>
            </div>
          </div>

          {/* Theme Toggle Section */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-8">
            <h2 className="text-xl font-semibold leading-7 text-gray-900 dark:text-white">
              Appearance
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
              Customize how KAICHAT looks on your device.
            </p>
            <div className="mt-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                <div className="flex items-center gap-3">
                  {theme === "light" ? (
                    <div className="p-2 bg-amber-100 rounded-xl">
                      <HiSun className="w-5 h-5 text-amber-500" />
                    </div>
                  ) : (
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl">
                      <HiMoon className="w-5 h-5 text-indigo-500" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {theme === "light" ? "Light Mode" : "Dark Mode"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {theme === "light" ? "Bright and clean interface" : "Easy on the eyes"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                    theme === "dark" ? "bg-sky-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                      theme === "dark" ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-x-4">
            <Button disabled={isLoading} secondary onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={isLoading} type="submit">
              Save
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default SettingsModal;
