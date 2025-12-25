"use client";
import clsx from "clsx";
import React from "react";

interface ButtonProps {
  type?: "button" | "submit" | "reset";
  fullWidth?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  type = "button",
  fullWidth,
  children,
  onClick,
  secondary,
  danger,
  disabled,
}) => {
  return (
    <button
      onClick={onClick}
      type={type}
      disabled={disabled}
      className={clsx(
        `btn-modern flex justify-center items-center rounded-xl px-4 py-2.5 text-sm font-semibold
        focus-visible:outline focus-visible:outline-offset-2 transition-all duration-300`,
        disabled && "opacity-50 cursor-default",
        fullWidth && "w-full",
        secondary 
          ? "text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600" 
          : "text-white",
        danger
          ? "bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 focus-visible:outline-rose-600 shadow-lg"
          : !secondary &&
              "gradient-primary hover:shadow-lg focus-visible:outline-sky-600"
      )}
    >
      {children}
    </button>
  );
};

export default Button;
