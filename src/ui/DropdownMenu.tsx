import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

const DropdownMenuContext = React.createContext<{ closeMenu: () => void } | null>(null);

type MenuPosition = {
  left: number;
  maxHeight: number;
  minWidth: number;
  placement: "top" | "bottom";
  top: number;
};

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function DropdownMenu({ trigger, children, className }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setIsOpen(false), []);

  const updateMenuPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 6;
    const minWidth = Math.max(160, rect.width);
    const measuredWidth = Math.max(contentRef.current?.offsetWidth ?? 192, minWidth);
    const width = Math.min(measuredWidth, window.innerWidth - viewportPadding * 2);
    const naturalHeight = contentRef.current?.scrollHeight ?? contentRef.current?.offsetHeight ?? 320;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const placement = spaceBelow < Math.min(naturalHeight, 260) && spaceAbove > spaceBelow ? "top" : "bottom";
    const availableHeight = Math.max(
      96,
      (placement === "top" ? spaceAbove : spaceBelow) - gap
    );
    const maxHeight = Math.min(420, availableHeight);
    const renderedHeight = Math.min(naturalHeight, maxHeight);
    const left = Math.min(
      Math.max(rect.right - width, viewportPadding),
      window.innerWidth - width - viewportPadding
    );
    const preferredTop =
      placement === "top" ? rect.top - gap - renderedHeight : rect.bottom + gap;
    const top = Math.min(
      Math.max(preferredTop, viewportPadding),
      window.innerHeight - renderedHeight - viewportPadding
    );

    setMenuPosition({ left, maxHeight, minWidth, placement, top });
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !anchorRef.current?.contains(target) &&
        !contentRef.current?.contains(target)
      ) {
        closeMenu();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeMenu]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    updateMenuPosition();
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [closeMenu, isOpen, updateMenuPosition]);

  useLayoutEffect(() => {
    if (isOpen) updateMenuPosition();
  }, [children, className, isOpen, updateMenuPosition]);

  function toggleMenu() {
    if (!isOpen) updateMenuPosition();
    setIsOpen((open) => !open);
  }

  const menu =
    isOpen && menuPosition
      ? createPortal(
          <DropdownMenuContext.Provider value={{ closeMenu }}>
            <div
              className={cn(
                "ffaa-dropdown-content absolute right-0 mt-1 w-48 z-50",
                className
              )}
              data-placement={menuPosition.placement}
              ref={contentRef}
              style={{
                left: menuPosition.left,
                marginTop: 0,
                maxHeight: menuPosition.maxHeight,
                maxWidth: "calc(100vw - 16px)",
                minWidth: menuPosition.minWidth,
                overflowY: "auto",
                position: "fixed",
                right: "auto",
                top: menuPosition.top,
              }}
            >
              <div className="ffaa-dropdown-list">
                {children}
              </div>
            </div>
          </DropdownMenuContext.Provider>,
          document.body
        )
      : null;

  return (
    <div className="ffaa-dropdown relative" ref={anchorRef}>
      <div className="ffaa-dropdown-anchor" onClick={toggleMenu}>
        {trigger}
      </div>
      {menu}
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
  const menuContext = React.useContext(DropdownMenuContext);

  return (
    <button
      onClick={() => {
        if (!disabled) {
          onClick();
          menuContext?.closeMenu();
        }
      }}
      disabled={disabled}
      className={cn(
        "ffaa-dropdown-item",
        className
      )}
    >
      {children}
    </button>
  );
}
