"use client";

import { FieldErrors, FieldValues, UseFormRegister } from "react-hook-form";
import { useState, useRef, useEffect, useCallback, memo } from "react";
import { HiFaceSmile } from "react-icons/hi2";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

interface MessageInputProps {
  placeholder?: string;
  id: string;
  required?: boolean;
  register: UseFormRegister<FieldValues>;
  errors: FieldErrors;
  onValueChange?: (value: string) => void;
  conversationUsers?: any[];
  currentUserEmail?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

const MessageInput: React.FC<MessageInputProps> = ({
  placeholder,
  id,
  required,
  register,
  onValueChange,
  conversationUsers = [],
  currentUserEmail,
  inputRef: externalInputRef,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const internalInputRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = externalInputRef || internalInputRef;
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false); // Track IME composition

  const { onChange, ref, name, onBlur } = register(id, { required });

  // Auto-focus input when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  // Handle click outside for emoji picker - use mousedown to prevent focus loss
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
        // Re-focus input after closing emoji picker
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setInputValue(value);
    onChange(e);
    onValueChange?.(value);

    // Check for @ mention
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Check if there's no space after @
      if (!textAfterAt.includes(' ')) {
        setMentionSearch(textAfterAt.toLowerCase());
        setMentionStartPos(lastAtIndex);
        setShowMentions(true);
        setSelectedMentionIndex(0);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  }, [onChange, onValueChange]);

  // Handle IME composition (for Vietnamese, Chinese, Japanese input)
  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = false;
    // Trigger change after composition ends
    const target = e.target as HTMLTextAreaElement;
    setInputValue(target.value);
    onValueChange?.(target.value);
  }, [onValueChange]);

  // Prevent blur during certain interactions
  const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    // Don't trigger blur if clicking on emoji picker or mention dropdown
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (
      relatedTarget &&
      (emojiPickerRef.current?.contains(relatedTarget) ||
        mentionRef.current?.contains(relatedTarget))
    ) {
      e.preventDefault();
      return;
    }
    onBlur(e);
  }, [onBlur]);

  const filteredUsers = conversationUsers.filter(user =>
    user.email !== currentUserEmail && // Exclude current user
    user.name?.toLowerCase().includes(mentionSearch)
  );

  const insertMention = useCallback((userName: string) => {
    const beforeMention = inputValue.substring(0, mentionStartPos);
    const afterMention = inputValue.substring(inputRef.current?.selectionStart || inputValue.length);
    const newValue = `${beforeMention}@${userName} ${afterMention}`;
    
    setInputValue(newValue);
    setShowMentions(false);
    
    if (inputRef.current) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      nativeInputValueSetter?.call(inputRef.current, newValue);
      const inputEvent = new Event("input", { bubbles: true });
      const changeEvent = new Event("change", { bubbles: true });
      inputRef.current.dispatchEvent(inputEvent);
      inputRef.current.dispatchEvent(changeEvent);
      
      // Set cursor position after mention
      const cursorPos = beforeMention.length + userName.length + 2;
      requestAnimationFrame(() => {
        inputRef.current?.setSelectionRange(cursorPos, cursorPos);
        inputRef.current?.focus();
      });
    }
    
    onValueChange?.(newValue);
  }, [inputValue, mentionStartPos, onValueChange]);

  const handleEmojiClick = useCallback((emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    const cursorPos = inputRef.current?.selectionStart ?? inputValue.length;
    const newValue = inputValue.slice(0, cursorPos) + emoji + inputValue.slice(cursorPos);
    
    setInputValue(newValue);
    if (inputRef.current) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      nativeInputValueSetter?.call(inputRef.current, newValue);
      const inputEvent = new Event("input", { bubbles: true });
      const changeEvent = new Event("change", { bubbles: true });
      inputRef.current.dispatchEvent(inputEvent);
      inputRef.current.dispatchEvent(changeEvent);
      
      // Set cursor after emoji
      const newCursorPos = cursorPos + emoji.length;
      requestAnimationFrame(() => {
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
        inputRef.current?.focus();
      });
    }

    onValueChange?.(newValue);
    setShowEmojiPicker(false);
  }, [inputValue, onValueChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't handle keys during IME composition
    if (isComposingRef.current) return;
    
    if (showMentions && filteredUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex((prev) => 
          prev < filteredUsers.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex((prev) => 
          prev > 0 ? prev - 1 : filteredUsers.length - 1
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredUsers[selectedMentionIndex].name);
        return;
      }
      if (e.key === "Escape") {
        setShowMentions(false);
        return;
      }
    }
    
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = inputRef.current?.closest("form");
      form?.requestSubmit();
    }
  }, [showMentions, filteredUsers, selectedMentionIndex, insertMention]);

  // Clear input value externally (called from Form after submit)
  const clearInput = useCallback(() => {
    setInputValue("");
  }, []);

  // Expose clearInput method
  useEffect(() => {
    if (inputRef.current) {
      (inputRef.current as any).clearInput = clearInput;
    }
  }, [clearInput]);

  return (
    <div className="relative w-full">
      <div className="relative flex-1">
        <textarea
          ref={(e) => {
            ref(e);
            (inputRef as any).current = e;
          }}
          id={id}
          name={name}
          autoComplete="off"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder={placeholder}
          rows={1}
          className="text-black font-light py-2 pl-4 pr-12 bg-neutral-100 w-full rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none overflow-y-auto max-h-[120px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
          style={{ minHeight: "40px" }}
        />
        
        {/* Emoji Picker Button - Inside Input (Right) */}
        <div className="absolute right-2 bottom-2" ref={emojiPickerRef}>
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1 text-gray-400 hover:text-sky-500 transition rounded-full hover:bg-gray-200"
          >
            <HiFaceSmile size={20} />
          </button>

          {showEmojiPicker && (
            <div className="absolute bottom-10 right-0 z-50 shadow-2xl">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                width={350}
                height={400}
                searchPlaceHolder="Tìm emoji..."
                previewConfig={{ showPreview: false }}
              />
            </div>
          )}
        </div>

        {/* Mention Dropdown */}
        {showMentions && filteredUsers.length > 0 && (
          <div 
            ref={mentionRef}
            className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto z-50"
          >
            {filteredUsers.map((user, index) => (
              <div
                key={user.id}
                onClick={() => insertMention(user.name)}
                className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition ${
                  index === selectedMentionIndex
                    ? "bg-sky-100"
                    : "hover:bg-gray-100"
                }`}
              >
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white font-semibold">
                    {user.name?.[0]?.toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium text-gray-900">
                  {user.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(MessageInput);
