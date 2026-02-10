import { formatTime } from "@/lib/time";

type TransportProps = {
  isPlaying: boolean;
  playheadSec: number;
  durationSec: number;
  disabled?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (value: number) => void;
};

export default function Transport({
  isPlaying,
  playheadSec,
  durationSec,
  disabled,
  onPlay,
  onPause,
  onStop,
  onSeek
}: TransportProps) {
  const safeDuration = Number.isFinite(durationSec) ? durationSec : 0;
  const canSeek = safeDuration > 0 && !disabled;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={isPlaying ? onPause : onPlay}
          disabled={disabled}
          className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={disabled}
          className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Stop
        </button>
        <div className="text-sm text-slate-300">
          {formatTime(playheadSec)} / {formatTime(safeDuration)}
        </div>
      </div>
      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={safeDuration}
          step={0.05}
          value={Math.min(playheadSec, safeDuration)}
          onChange={(event) => onSeek(Number(event.target.value))}
          disabled={!canSeek}
          className="w-full accent-sky-400 disabled:opacity-50"
        />
      </div>
    </div>
  );
}
