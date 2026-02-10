let apiPromise: Promise<typeof YT> | null = null;

export function extractVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace("www.", "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }

    if (host.endsWith("youtube.com")) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }

      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.split("/shorts/")[1]?.split("/")[0] ?? null;
      }

      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/embed/")[1]?.split("/")[0] ?? null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function loadYouTubeIframeAPI(): Promise<typeof YT> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API requires a browser environment"));
  }

  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }

  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
    }

    window.onYouTubeIframeAPIReady = () => {
      resolve(window.YT);
    };
  });

  return apiPromise;
}

export function createPlayer(container: HTMLElement, options: YT.PlayerOptions): YT.Player {
  return new window.YT.Player(container, options);
}
