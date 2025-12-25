"use client";

import ReactSelect from "react-select";
import { useTheme } from "@/app/context/ThemeContext";

interface SelectProps {
  label: string;
  value?: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  options: Record<string, any>[];
  disabled?: boolean;
}

const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  disabled,
}) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="z-100">
      <label className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">
        {label}
      </label>
      <div className="mt-2">
        <ReactSelect
          isDisabled={disabled}
          value={value}
          onChange={onChange}
          isMulti
          options={options}
          menuPortalTarget={document.body}
          styles={{
            menuPortal: (base) => ({
              ...base,
              zIndex: 9999,
            }),
            control: (base, state) => ({
              ...base,
              backgroundColor: isDark ? "#334155" : "#fff",
              borderColor: state.isFocused 
                ? "#0ea5e9" 
                : isDark ? "#475569" : "#d1d5db",
              boxShadow: state.isFocused ? "0 0 0 2px rgba(14, 165, 233, 0.2)" : "none",
              "&:hover": {
                borderColor: "#0ea5e9",
              },
            }),
            menu: (base) => ({
              ...base,
              backgroundColor: isDark ? "#1e293b" : "#fff",
              border: isDark ? "1px solid #475569" : "1px solid #e5e7eb",
            }),
            option: (base, state) => ({
              ...base,
              backgroundColor: state.isSelected
                ? "#0ea5e9"
                : state.isFocused
                ? isDark ? "#334155" : "#f1f5f9"
                : "transparent",
              color: state.isSelected 
                ? "#fff" 
                : isDark ? "#f1f5f9" : "#1f2937",
              "&:active": {
                backgroundColor: "#0ea5e9",
              },
            }),
            multiValue: (base) => ({
              ...base,
              backgroundColor: isDark ? "#475569" : "#e0f2fe",
            }),
            multiValueLabel: (base) => ({
              ...base,
              color: isDark ? "#f1f5f9" : "#0369a1",
            }),
            multiValueRemove: (base) => ({
              ...base,
              color: isDark ? "#94a3b8" : "#0369a1",
              "&:hover": {
                backgroundColor: isDark ? "#64748b" : "#bae6fd",
                color: isDark ? "#f1f5f9" : "#0c4a6e",
              },
            }),
            input: (base) => ({
              ...base,
              color: isDark ? "#f1f5f9" : "#1f2937",
            }),
            placeholder: (base) => ({
              ...base,
              color: isDark ? "#94a3b8" : "#9ca3af",
            }),
            singleValue: (base) => ({
              ...base,
              color: isDark ? "#f1f5f9" : "#1f2937",
            }),
          }}
          classNames={{
            control: () => "text-sm",
          }}
        />
      </div>
    </div>
  );
};

export default Select;
