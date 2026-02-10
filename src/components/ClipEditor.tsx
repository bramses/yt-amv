"use client";

import { useMemo, useState } from "react";
import { extractVideoId } from "@/lib/youtube";
import { Clip, ClipKind } from "@/lib/types";
import { formatTime, parseTime } from "@/lib/time";

const DEFAULT_VOLUME = 100;

type ClipEditorProps = {
  clips: Clip[];
  onAdd: (clip: Clip) => void;
  onUpdate: (clip: Clip) => void;
  onDelete: (id: string) => void;
};

type TimeField = "start" | "in" | "out";

type TimeInputState = {
  start: string;
  in: string;
  out: string;
};

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `clip_${Math.random().toString(36).slice(2)}`;
}

export default function ClipEditor({ clips, onAdd, onUpdate, onDelete }: ClipEditorProps) {
  const [kind, setKind] = useState<ClipKind>("video");
  const [url, setUrl] = useState("");
  const [timelineStart, setTimelineStart] = useState("0:00");
  const [inPoint, setInPoint] = useState("0:00");
  const [outPoint, setOutPoint] = useState("0:10");
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [formError, setFormError] = useState<string | null>(null);

  const [editInputs, setEditInputs] = useState<Record<string, TimeInputState>>({});

  const formReady = useMemo(() => {
    const hasUrl = url.trim().length > 0;
    return hasUrl && timelineStart.trim().length > 0 && inPoint.trim().length > 0 && outPoint.trim().length > 0;
  }, [url, timelineStart, inPoint, outPoint]);

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const videoId = extractVideoId(url);
    if (!videoId) {
      setFormError("Enter a valid YouTube URL or video ID.");
      return;
    }

    const startSec = parseTime(timelineStart);
    const inSec = parseTime(inPoint);
    const outSec = parseTime(outPoint);

    if (![startSec, inSec, outSec].every((value) => Number.isFinite(value))) {
      setFormError("Times must be in mm:ss or hh:mm:ss format.");
      return;
    }

    if (startSec < 0 || inSec < 0 || outSec <= inSec) {
      setFormError("Times must be non-negative and end after start.");
      return;
    }

    const clip: Clip = {
      id: makeId(),
      kind,
      url: url.trim(),
      videoId,
      timelineStartSec: startSec,
      inSec,
      outSec,
      volume
    };

    onAdd(clip);
    setUrl("");
    setTimelineStart(formatTime(startSec));
    setInPoint(formatTime(inSec));
    setOutPoint(formatTime(outSec));
  };

  const updateTimeInput = (clipId: string, field: TimeField, value: string) => {
    setEditInputs((prev) => ({
      ...prev,
      [clipId]: {
        start: prev[clipId]?.start ?? "",
        in: prev[clipId]?.in ?? "",
        out: prev[clipId]?.out ?? "",
        [field]: value
      }
    }));
  };

  const commitTimeInput = (clip: Clip, field: TimeField, value: string) => {
    const parsed = parseTime(value);
    if (!Number.isFinite(parsed)) {
      setEditInputs((prev) => ({
        ...prev,
        [clip.id]: {
          start: field === "start" ? formatTime(clip.timelineStartSec) : prev[clip.id]?.start ?? formatTime(clip.timelineStartSec),
          in: field === "in" ? formatTime(clip.inSec) : prev[clip.id]?.in ?? formatTime(clip.inSec),
          out: field === "out" ? formatTime(clip.outSec) : prev[clip.id]?.out ?? formatTime(clip.outSec)
        }
      }));
      return;
    }

    const nextClip: Clip = {
      ...clip,
      timelineStartSec: field === "start" ? parsed : clip.timelineStartSec,
      inSec: field === "in" ? parsed : clip.inSec,
      outSec: field === "out" ? parsed : clip.outSec
    };

    onUpdate(nextClip);

    setEditInputs((prev) => ({
      ...prev,
      [clip.id]: {
        start: field === "start" ? formatTime(parsed) : prev[clip.id]?.start ?? formatTime(nextClip.timelineStartSec),
        in: field === "in" ? formatTime(parsed) : prev[clip.id]?.in ?? formatTime(nextClip.inSec),
        out: field === "out" ? formatTime(parsed) : prev[clip.id]?.out ?? formatTime(nextClip.outSec)
      }
    }));
  };

  const getTimeValue = (clip: Clip, field: TimeField) => {
    const stored = editInputs[clip.id]?.[field];
    if (stored !== undefined) return stored;

    if (field === "start") return formatTime(clip.timelineStartSec);
    if (field === "in") return formatTime(clip.inSec);
    return formatTime(clip.outSec);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="text-sm font-semibold text-slate-200">Add clip</div>
        <div className="mt-3 grid gap-4 md:grid-cols-6">
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-slate-400">
            Type
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as ClipKind)}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="video">Video</option>
              <option value="audio">Audio</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-slate-400 md:col-span-2">
            YouTube URL / ID
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://youtu.be/VIDEO_ID"
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-slate-400">
            Timeline start
            <input
              value={timelineStart}
              onChange={(event) => setTimelineStart(event.target.value)}
              placeholder="0:00"
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-slate-400">
            In
            <input
              value={inPoint}
              onChange={(event) => setInPoint(event.target.value)}
              placeholder="0:00"
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-slate-400">
            Out
            <input
              value={outPoint}
              onChange={(event) => setOutPoint(event.target.value)}
              placeholder="0:10"
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-slate-400">
            Volume
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              className="accent-sky-400"
            />
          </label>
        </div>
        {formError ? <div className="mt-3 text-sm text-rose-200">{formError}</div> : null}
        <div className="mt-4">
          <button
            type="submit"
            disabled={!formReady}
            className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add clip
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="text-sm font-semibold text-slate-200">Clips</div>
        {clips.length === 0 ? (
          <div className="mt-3 text-sm text-slate-400">No clips yet.</div>
        ) : (
          <div className="mt-4 space-y-4">
            {clips.map((clip) => (
              <div
                key={clip.id}
                className="grid gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3 md:grid-cols-9"
              >
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-slate-400">
                  Type
                  <select
                    value={clip.kind}
                    onChange={(event) => {
                      const nextKind = event.target.value as ClipKind;
                      onUpdate({
                        ...clip,
                        kind: nextKind
                      });
                    }}
                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="video">Video</option>
                    <option value="audio">Audio</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-slate-400 md:col-span-2">
                  URL / ID
                  <input
                    value={clip.url}
                    onChange={(event) => {
                      const nextUrl = event.target.value;
                      onUpdate({
                        ...clip,
                        url: nextUrl,
                        videoId: extractVideoId(nextUrl) ?? ""
                      });
                    }}
                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-slate-400">
                  Start
                  <input
                    value={getTimeValue(clip, "start")}
                    onChange={(event) => updateTimeInput(clip.id, "start", event.target.value)}
                    onBlur={(event) => commitTimeInput(clip, "start", event.target.value)}
                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-slate-400">
                  In
                  <input
                    value={getTimeValue(clip, "in")}
                    onChange={(event) => updateTimeInput(clip.id, "in", event.target.value)}
                    onBlur={(event) => commitTimeInput(clip, "in", event.target.value)}
                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-slate-400">
                  Out
                  <input
                    value={getTimeValue(clip, "out")}
                    onChange={(event) => updateTimeInput(clip.id, "out", event.target.value)}
                    onBlur={(event) => commitTimeInput(clip, "out", event.target.value)}
                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase text-slate-400">
                  Volume
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={clip.volume}
                    onChange={(event) =>
                      onUpdate({
                        ...clip,
                        volume: Number(event.target.value)
                      })
                    }
                    className="accent-sky-400"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => onDelete(clip.id)}
                    className="rounded-md border border-rose-700/60 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200 hover:border-rose-500 hover:bg-rose-500/20"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
