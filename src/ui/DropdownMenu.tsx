import React, { useState, useRef, useEffect } from "react";
import { cn } from "./cn";

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function DropdownMenu({ trigger, children, className }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      {isOpen && (
        <div className={cn(
          "absolute right-0 mt-1 w-48 rounded-[16px] border border-[rgba(255,255,255,0.12)] bg-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03)) shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-[20px] z-50",
          className
        )}>
          <div className="py-2">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

interface DropdownMenuItemProps {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function DropdownMenuItem({ onClick, children, disabled, className }: DropdownMenuItemProps) {
  return (
    <button
      onClick={() => {
        if (!disabled) {
          onClick();
        }
      }}
      disabled={disabled}
      className={cn(
        "w-full px-4 py-2 text-left text-sm text-fg0 hover:bg-[rgba(255,255,255,0.08)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      {children}
    </button>
  );
}
