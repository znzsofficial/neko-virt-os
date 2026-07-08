import type { ComponentType } from "react";
import { ApiTesterApp } from "./appModules/ApiTesterApp";
import { MusicPlayerApp } from "./appModules/MusicPlayerApp";
import { QrToolApp } from "./appModules/QrToolApp";
import { RecorderApp } from "./appModules/RecorderApp";
import { VideoPlayerApp } from "./appModules/VideoPlayerApp";
import type { AppId } from "./types";

export const appComponentRegistry: Partial<Record<AppId, ComponentType>> = {
  "api-tester": ApiTesterApp,
  "qr-tool": QrToolApp,
  recorder: RecorderApp,
  "music-player": MusicPlayerApp,
  "video-player": VideoPlayerApp,
};
