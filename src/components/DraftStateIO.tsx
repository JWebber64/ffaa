import React, { useRef } from "react";
import { Button, HStack, Input, useToast } from "@chakra-ui/react";
import { useDraftStore, normalizeImportedDraftState } from "../store/draftStore";
import { toastError } from "../utils/toastError";

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DraftStateIO() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onExport = () => {
    try {
      // Export the full persisted store state. If you want a narrower export later,
      // change this to pick only the relevant keys.
      const state = useDraftStore.getState();
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      downloadJson(`ffaa-draft-${stamp}.json`, {
        __type: "ffaa_draft_export",
        __version: 1,
        state,
      });
    } catch (err) {
      toast(toastError("Export failed", err));
    }
  };

  const onPickFile = () => {
    fileRef.current?.click();
  };

  const onImportFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing same file
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;

      const normalized = normalizeImportedDraftState(parsed);
      if (!normalized) {
        throw new Error("Invalid draft file (unrecognized format).");
      }

      // Overwrite store state. This is intentional.
      // Zustand setState supports (partial, replace) where replace=true replaces entire state.
      useDraftStore.setState(normalized as any, true);

      toast({
        title: "Draft imported",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
    } catch (err) {
      toast(toastError("Import failed", err));
    }
  };

  return (
    <HStack spacing={2}>
      <Button size="sm" onClick={onExport}>
        Export Draft
      </Button>

      <Button size="sm" variant="outline" onClick={onPickFile}>
        Import Draft
      </Button>

      <Input
        ref={fileRef}
        type="file"
        accept="application/json"
        display="none"
        onChange={onImportFile}
      />
    </HStack>
  );
}
