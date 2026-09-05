import React from "react";
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
    <div className="modal-lite-root">
      <div className="modal-lite-backdrop" onClick={onClose} />
      <div className="modal-lite-slot">
        <Card className="modal-lite-content" role="dialog" aria-modal="true" aria-label={title}>
          <CardHeader className="flex items-center justify-between">
            <div className="text-base font-semibold text-fg0">{title}</div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </CardHeader>
          <CardBody className="modal-lite-body">{children}</CardBody>
        </Card>
      </div>
    </div>
  );
}
