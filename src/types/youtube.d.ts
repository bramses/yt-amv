export {};

declare namespace YT {
  type PlayerOptions = {
    height?: string;
    width?: string;
    videoId?: string;
    playerVars?: Record<string, string | number | boolean>;
    events?: Record<string, (event: any) => void>;
  };

  type Player = {
    loadVideoById?: (options: { videoId: string; startSeconds?: number }) => void;
    cueVideoById?: (options: { videoId: string; startSeconds?: number }) => void;
    playVideo?: () => void;
    pauseVideo?: () => void;
    stopVideo?: () => void;
    seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
    setVolume?: (volume: number) => void;
    destroy?: () => void;
  };

  const Player: new (container: HTMLElement, options: PlayerOptions) => Player;
}

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }

  const YT: typeof YT;
}
