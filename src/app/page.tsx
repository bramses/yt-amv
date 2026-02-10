"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ClipEditor from "@/components/ClipEditor";
import Transport from "@/components/Transport";
import ValidationBanner from "@/components/ValidationBanner";
import { Clip } from "@/lib/types";
import { formatTime } from "@/lib/time";
import { createPlayer, loadYouTubeIframeAPI } from "@/lib/youtube";

const VIDEO_PLAYER_OPTIONS: YT.PlayerOptions = {
  height: "360",
  width: "640",
  playerVars: {
    autoplay: 0,
    controls: 1,
    playsinline: 1,
    rel: 0,
    modestbranding: 1
  }
};

const AUDIO_PLAYER_OPTIONS: YT.PlayerOptions = {
  height: "0",
  width: "0",
  playerVars: {
    autoplay: 0,
    controls: 0,
    disablekb: 1,
    fs: 0,
    iv_load_policy: 3,
    playsinline: 1,
    rel: 0,
    modestbranding: 1
  }
};

const MAX_URL_PAYLOAD_LENGTH = 1500;

type EncodedClip = ["v" | "a", string, number, number, number, number];

const roundTime = (value: number) => Math.round(value * 100) / 100;

const encodeClips = (clips: Clip[]) => {
  const payload = {
    v: 1,
    c: clips.map(
      (clip): EncodedClip => [
        clip.kind === "video" ? "v" : "a",
        clip.videoId,
        roundTime(clip.timelineStartSec),
        roundTime(clip.inSec),
        roundTime(clip.outSec),
        Math.round(clip.volume)
      ]
    )
  };

  const json = JSON.stringify(payload);
  const base64 = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return base64;
};

const decodeClips = (encoded: string): Clip[] => {
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const json = atob(padded);
  const data = JSON.parse(json) as { v: number; c: EncodedClip[] };

  if (!data || data.v !== 1 || !Array.isArray(data.c)) return [];

  return data.c
    .map((tuple) => {
      const [kind, videoId, start, inSec, outSec, volume] = tuple;
      if (!videoId) return null;
      return {
        id: `clip_${Math.random().toString(36).slice(2)}`,
        kind: kind === "v" ? "video" : "audio",
        url: `https://youtu.be/${videoId}`,
        videoId,
        timelineStartSec: Number(start),
        inSec: Number(inSec),
        outSec: Number(outSec),
        volume: Number(volume)
      } satisfies Clip;
    })
    .filter(Boolean) as Clip[];
};

export default function Home() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [importText, setImportText] = useState("");

  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const videoPlayerRef = useRef<any | null>(null);
  const audioPlayersRef = useRef<Map<string, any>>(new Map());
  const playingAudioIdsRef = useRef<Set<string>>(new Set());
  const currentVideoClipIdRef = useRef<string | null>(null);
  const resyncRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const startWallRef = useRef(0);

  const videoClips = useMemo(() => clips.filter((clip) => clip.kind === "video"), [clips]);
  const audioClips = useMemo(() => clips.filter((clip) => clip.kind === "audio"), [clips]);

  const encodedClips = useMemo(() => {
    if (clips.length === 0) return "";
    return encodeClips(clips);
  }, [clips]);

  const encodedTooLong = encodedClips.length > MAX_URL_PAYLOAD_LENGTH;

  const totalDuration = useMemo(() => {
    return clips.reduce((maxDuration, clip) => {
      const duration = clip.outSec - clip.inSec;
      if (duration <= 0) return maxDuration;
      return Math.max(maxDuration, clip.timelineStartSec + duration);
    }, 0);
  }, [clips]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    clips.forEach((clip) => {
      if (!clip.videoId) {
        errors.push(`Clip "${clip.url || clip.id}" needs a valid YouTube ID.`);
      }
      if (clip.timelineStartSec < 0) {
        errors.push("Timeline start must be 0 or greater.");
      }
      if (clip.inSec < 0 || clip.outSec <= clip.inSec) {
        errors.push("Clip in/out times must be non-negative and end after start.");
      }
    });

    const sortedVideos = [...videoClips]
      .filter((clip) => clip.videoId && clip.outSec > clip.inSec)
      .sort((a, b) => a.timelineStartSec - b.timelineStartSec);

    for (let i = 1; i < sortedVideos.length; i += 1) {
      const prev = sortedVideos[i - 1];
      const current = sortedVideos[i];
      const prevEnd = prev.timelineStartSec + (prev.outSec - prev.inSec);
      if (current.timelineStartSec < prevEnd) {
        errors.push("Video clips overlap on the timeline. Only one video can play at a time.");
        break;
      }
    }

    return errors;
  }, [clips, videoClips]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payload = params.get("p");
    if (payload) {
      try {
        const imported = decodeClips(payload);
        if (imported.length > 0) {
          setClips(imported);
        }
      } catch {
        setSaveMessage("Could not load data from URL.");
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    loadYouTubeIframeAPI()
      .then(() => {
        if (mounted) setApiReady(true);
      })
      .catch(() => {
        if (mounted) setApiReady(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!apiReady) return;
    if (videoPlayerRef.current) return;
    if (!videoContainerRef.current) return;

    const seed = videoClips.find((clip) => clip.videoId);
    if (!seed) return;

    videoPlayerRef.current = createPlayer(videoContainerRef.current, {
      ...VIDEO_PLAYER_OPTIONS,
      videoId: seed.videoId
    });
  }, [apiReady, videoClips]);

  useEffect(() => {
    const existingIds = new Set(clips.map((clip) => clip.id));
    for (const [id, player] of audioPlayersRef.current.entries()) {
      if (!existingIds.has(id)) {
        player.destroy?.();
        audioPlayersRef.current.delete(id);
        playingAudioIdsRef.current.delete(id);
      }
    }
  }, [clips]);

  useEffect(() => {
    if (playheadSec > totalDuration) {
      setPlayheadSec(totalDuration);
      resyncRef.current = true;
    }
  }, [playheadSec, totalDuration]);

  useEffect(() => {
    resyncRef.current = true;
  }, [clips]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = () => {
      const now = performance.now();
      const nextTime = (now - startWallRef.current) / 1000;

      if (totalDuration > 0 && nextTime >= totalDuration) {
        setPlayheadSec(totalDuration);
        setIsPlaying(false);
        resyncRef.current = true;
        return;
      }

      setPlayheadSec(nextTime);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, totalDuration]);

  const ensureAudioPlayer = (clip: Clip) => {
    if (!apiReady || !clip.videoId) return null;
    const existing = audioPlayersRef.current.get(clip.id);
    if (existing) return existing;

    const container = document.getElementById(`audio-player-${clip.id}`);
    if (!container) return null;

    const player = createPlayer(container, {
      ...AUDIO_PLAYER_OPTIONS,
      videoId: clip.videoId
    });

    audioPlayersRef.current.set(clip.id, player);
    return player;
  };

  useEffect(() => {
    if (!apiReady) return;

    const activeVideo = videoClips.find((clip) => {
      const duration = clip.outSec - clip.inSec;
      const end = clip.timelineStartSec + duration;
      return duration > 0 && playheadSec >= clip.timelineStartSec && playheadSec < end;
    });

    const videoPlayer = videoPlayerRef.current;
    const shouldResync = resyncRef.current;

    if (videoPlayer && activeVideo) {
      const offset = playheadSec - activeVideo.timelineStartSec + activeVideo.inSec;
      const shouldSwitch = currentVideoClipIdRef.current !== activeVideo.id;

      if (shouldSwitch || shouldResync) {
        if (isPlaying && videoPlayer.loadVideoById) {
          videoPlayer.loadVideoById({ videoId: activeVideo.videoId, startSeconds: offset });
        } else if (videoPlayer.cueVideoById) {
          videoPlayer.cueVideoById({ videoId: activeVideo.videoId, startSeconds: offset });
        } else if (videoPlayer.loadVideoById) {
          videoPlayer.loadVideoById({ videoId: activeVideo.videoId, startSeconds: offset });
        }
        currentVideoClipIdRef.current = activeVideo.id;
      }

      videoPlayer.setVolume?.(activeVideo.volume);

      if (!isPlaying && videoPlayer.pauseVideo) {
        videoPlayer.pauseVideo();
      }
    } else if (videoPlayer && currentVideoClipIdRef.current !== null) {
      videoPlayer.stopVideo?.();
      currentVideoClipIdRef.current = null;
    }

    audioClips.forEach((clip) => {
      if (!clip.videoId) return;
      const duration = clip.outSec - clip.inSec;
      if (duration <= 0) return;

      const end = clip.timelineStartSec + duration;
      const inRange = playheadSec >= clip.timelineStartSec && playheadSec < end;
      const player = ensureAudioPlayer(clip);
      if (!player) return;

      const playingIds = playingAudioIdsRef.current;

      if (inRange) {
        const offset = clip.inSec + (playheadSec - clip.timelineStartSec);
        if (shouldResync || !playingIds.has(clip.id)) {
          player.seekTo?.(offset, true);
        }
        player.setVolume?.(clip.volume);

        if (isPlaying) {
          player.playVideo?.();
          playingIds.add(clip.id);
        } else {
          player.pauseVideo?.();
        }
      } else if (playingIds.has(clip.id)) {
        player.pauseVideo?.();
        playingIds.delete(clip.id);
      }
    });

    if (!isPlaying) {
      for (const player of audioPlayersRef.current.values()) {
        player.pauseVideo?.();
      }
      playingAudioIdsRef.current.clear();
    }

    resyncRef.current = false;
  }, [apiReady, playheadSec, isPlaying, videoClips, audioClips]);

  const handleSaveToUrl = () => {
    if (!encodedClips || encodedTooLong) return;
    const url = new URL(window.location.href);
    url.searchParams.set("p", encodedClips);
    window.history.replaceState({}, "", url.toString());
    setSaveMessage("Saved to URL.");
  };

  const handleCopy = async () => {
    if (!encodedClips) return;
    try {
      await navigator.clipboard.writeText(encodedClips);
      setSaveMessage("Copied setup to clipboard.");
    } catch {
      setSaveMessage("Clipboard copy failed.");
    }
  };

  const handleImport = () => {
    const raw = importText.trim();
    if (!raw) return;

    let payload = raw;
    try {
      if (raw.startsWith("http://") || raw.startsWith("https://")) {
        const url = new URL(raw);
        payload = url.searchParams.get("p") ?? raw;
      } else if (raw.includes("p=")) {
        const url = new URL(raw, window.location.origin);
        payload = url.searchParams.get("p") ?? raw;
      }

      const imported = decodeClips(payload);
      if (imported.length === 0) {
        setSaveMessage("Import failed. String is invalid.");
        return;
      }
      setClips(imported);
      setPlayheadSec(0);
      setIsPlaying(false);
      resyncRef.current = true;
      setSaveMessage("Imported setup.");
    } catch {
      setSaveMessage("Import failed. String is invalid.");
    }
  };

  const handlePlay = () => {
    if (!apiReady || validationErrors.length > 0 || clips.length === 0) return;
    startWallRef.current = performance.now() - playheadSec * 1000;
    setIsPlaying(true);
    resyncRef.current = true;
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setPlayheadSec(0);
    resyncRef.current = true;
  };

  const handleSeek = (value: number) => {
    const clamped = Math.max(0, Math.min(value, totalDuration));
    setPlayheadSec(clamped);
    if (isPlaying) {
      startWallRef.current = performance.now() - clamped * 1000;
    }
    resyncRef.current = true;
  };

  const addClip = (clip: Clip) => {
    setClips((prev) => [...prev, clip]);
  };

  const updateClip = (nextClip: Clip) => {
    setClips((prev) => prev.map((clip) => (clip.id === nextClip.id ? nextClip : clip)));
  };

  const deleteClip = (id: string) => {
    setClips((prev) => prev.filter((clip) => clip.id !== id));
  };

  const playDisabled = validationErrors.length > 0 || clips.length === 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">YouTube Mashup Editor</h1>
        <p className="text-sm text-slate-300">
          Build non-linear mashups with one video track and layered audio. Use mm:ss or hh:mm:ss for time fields.
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          <a
            href="https://github.com/bramses/yt-amv"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-slate-600 underline-offset-4 hover:text-slate-200"
          >
            GitHub
          </a>
          <a
            href="https://www.bramadams.dev/"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-slate-600 underline-offset-4 hover:text-slate-200"
          >
            bramadams.dev
          </a>
        </div>
      </header>

      <ValidationBanner errors={validationErrors} />

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-sm font-semibold text-slate-200">Video preview</div>
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60">
            {videoClips.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                Add a video clip to render the player.
              </div>
            ) : (
              <div ref={videoContainerRef} className="aspect-video w-full" />
            )}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            YouTube embeds only. Autoplay requires clicking Play in this editor.
          </p>
        </div>

        <div className="space-y-4">
          <Transport
            isPlaying={isPlaying}
            playheadSec={playheadSec}
            durationSec={totalDuration}
            disabled={playDisabled}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
            onSeek={handleSeek}
          />
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
            <div className="font-semibold text-slate-200">Share / Import</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveToUrl}
                disabled={!encodedClips || encodedTooLong}
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save to URL
              </button>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!encodedClips}
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Copy setup
              </button>
            </div>
            {encodedTooLong ? (
              <div className="mt-2 text-xs text-amber-200">It&apos;s too complicated to save.</div>
            ) : null}
            {saveMessage ? <div className="mt-2 text-xs text-slate-400">{saveMessage}</div> : null}
            <div className="mt-3 flex gap-2">
              <input
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder="Paste setup string or URL"
                className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              />
              <button
                type="button"
                onClick={handleImport}
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-700"
              >
                Import
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
            <div className="font-semibold text-slate-200">Timeline</div>
            <div className="mt-2">
              Length: {formatTime(totalDuration)}
            </div>
            <div className="mt-1">Playhead: {formatTime(playheadSec)}</div>
          </div>
        </div>
      </section>

      <section>
        <ClipEditor clips={clips} onAdd={addClip} onUpdate={updateClip} onDelete={deleteClip} />
      </section>

      <div className="sr-only">
        {audioClips.map((clip) => (
          <div key={clip.id} id={`audio-player-${clip.id}`} />
        ))}
      </div>
    </main>
  );
}
