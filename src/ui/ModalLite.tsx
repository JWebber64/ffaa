import React from "react";
import { cn } from "./cn";
import { Button } from "./Button";
import { Card, CardBody, CardHeader } from "./Card";

export function ModalLite({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <Card className={cn("w-full max-w-[560px]")}>
          <CardHeader className="flex items-center justify-between">
            <div className="text-base font-semibold text-fg0">{title}</div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </CardHeader>
          <CardBody>{children}</CardBody>
        </Card>
      </div>
    </div>
  );
}
