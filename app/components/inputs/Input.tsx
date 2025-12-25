"use client";

import clsx from "clsx";
import { FieldErrors, FieldValues, UseFormRegister } from "react-hook-form";

interface InputProps {
  label: string;
  id: string;
  type?: string;
  required?: boolean;
  register: UseFormRegister<FieldValues>;
  errors: FieldErrors;
  disabled?: boolean;
}

const Input: React.FC<InputProps> = ({
  label,
  id,
  type,
  required,
  register,
  errors,
  disabled,
}) => {
  return (
    <div>
      <label
        className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100 mb-2"
        htmlFor={id}
      >
        {label}
      </label>
      <div>
        <input
          id={id}
          type={type}
          autoComplete={id}
          disabled={disabled}
          {...register(id, { required })}
          className={clsx(
            `block w-full rounded-xl border-0 px-4 py-3 text-gray-900 dark:text-white
            bg-gray-100 dark:bg-gray-800
            placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-sky-500
            transition-all duration-200
            sm:text-sm`,
            errors[id] && "ring-2 ring-rose-500",
            disabled && "opacity-50 cursor-default"
          )}
        />
      </div>
    </div>
  );
};

export default Input;
