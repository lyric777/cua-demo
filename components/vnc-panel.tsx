"use client";

import React, { memo } from "react";
import { Button } from "@/components/ui/button";

interface VncPanelProps {
  streamUrl: string | null;
  isInitializing: boolean;
  onRefresh: () => void;
}

function VncPanelComponent({ streamUrl, isInitializing, onRefresh }: VncPanelProps) {
  return (
    <>
      {streamUrl ? (
        <>
          <iframe
            src={streamUrl}
            className="w-full h-full"
            style={{ transformOrigin: "center", width: "100%", height: "100%" }}
            allow="autoplay"
          />
          <Button
            onClick={onRefresh}
            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white px-3 py-1 rounded text-sm z-10"
            disabled={isInitializing}
          >
            {isInitializing ? "Creating desktop..." : "New desktop"}
          </Button>
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-white">
          {isInitializing ? "Initializing desktop..." : "Loading stream..."}
        </div>
      )}
    </>
  );
}

export const VncPanel = memo(
  VncPanelComponent,
  (prev, next) =>
    prev.streamUrl === next.streamUrl &&
    prev.isInitializing === next.isInitializing &&
    prev.onRefresh === next.onRefresh
);
