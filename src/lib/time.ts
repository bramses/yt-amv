export function parseTime(input: string): number {
  const raw = input.trim();
  if (!raw) return Number.NaN;

  const parts = raw.split(":");
  if (parts.length > 3) return Number.NaN;

  const nums = parts.map((part) => {
    if (!/^[0-9]+$/.test(part)) return Number.NaN;
    return Number(part);
  });

  if (nums.some((n) => !Number.isFinite(n))) return Number.NaN;

  if (nums.length === 1) {
    return nums[0];
  }

  if (nums.length === 2) {
    const [mm, ss] = nums;
    if (ss > 59) return Number.NaN;
    return mm * 60 + ss;
  }

  const [hh, mm, ss] = nums;
  if (mm > 59 || ss > 59) return Number.NaN;
  return hh * 3600 + mm * 60 + ss;
}

export function formatTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(safeSeconds / 3600);
  const mm = Math.floor((safeSeconds % 3600) / 60);
  const ss = safeSeconds % 60;

  const pad2 = (value: number) => String(value).padStart(2, "0");

  if (hh > 0) {
    return `${hh}:${pad2(mm)}:${pad2(ss)}`;
  }

  return `${mm}:${pad2(ss)}`;
}
