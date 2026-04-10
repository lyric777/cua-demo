"use client";

import React, { memo } from "react";
import { Button } from "@/components/ui/button";

interface VncPanelProps {
  streamUrl: string | null;
  isInitializing: boolean;
  onRefresh: () => void;
  onClose: () => void;
}

function VncPanelComponent({ streamUrl, isInitializing, onRefresh, onClose }: VncPanelProps) {
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
          <div className="absolute top-2 right-2 flex gap-2 z-10">
            <Button
              onClick={onRefresh}
              className="bg-black/50 hover:bg-black/70 text-white px-3 py-1 rounded text-sm"
              disabled={isInitializing}
            >
              {isInitializing ? "Creating desktop..." : "New desktop"}
            </Button>
            <Button
              onClick={onClose}
              className="bg-black/50 hover:bg-red-600/80 text-white px-3 py-1 rounded text-sm"
              disabled={isInitializing}
            >
              Close desktop
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 h-full text-white">
          {isInitializing ? (
            <span>Initializing desktop...</span>
          ) : (
            <>
              <span className="text-zinc-400 text-sm">No desktop running</span>
              <Button
                onClick={onRefresh}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded text-sm"
              >
                Start new desktop
              </Button>
            </>
          )}
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
    prev.onRefresh === next.onRefresh &&
    prev.onClose === next.onClose
);
