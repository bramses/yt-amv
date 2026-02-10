export type ClipKind = "video" | "audio";

export type Clip = {
  id: string;
  kind: ClipKind;
  url: string;
  videoId: string;
  timelineStartSec: number;
  inSec: number;
  outSec: number;
  volume: number;
};
