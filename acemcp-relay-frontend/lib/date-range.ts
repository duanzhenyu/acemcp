import { StatsRangePreset } from "@/lib/types";

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function toShanghaiEpoch(date: Date): number {
  return date.getTime() + SHANGHAI_OFFSET_MS;
}

function fromShanghaiEpoch(ms: number): Date {
  return new Date(ms - SHANGHAI_OFFSET_MS);
}

function startOfShanghaiDay(date: Date): Date {
  const shanghai = new Date(toShanghaiEpoch(date));
  const start = Date.UTC(
    shanghai.getUTCFullYear(),
    shanghai.getUTCMonth(),
    shanghai.getUTCDate(),
    0,
    0,
    0,
    0
  );
  return fromShanghaiEpoch(start);
}

function startOfShanghaiMonth(date: Date): Date {
  const shanghai = new Date(toShanghaiEpoch(date));
  const start = Date.UTC(
    shanghai.getUTCFullYear(),
    shanghai.getUTCMonth(),
    1,
    0,
    0,
    0,
    0
  );
  return fromShanghaiEpoch(start);
}

function formatShanghaiDate(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
  }).format(date);
}

export interface ResolvedDateRange {
  preset: StatsRangePreset;
  label: string;
  startAt: Date;
  endAt: Date;
}

export function resolveDateRange(input: {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
}): ResolvedDateRange {
  const preset = (input.preset || "today") as StatsRangePreset;
  const now = new Date();
  const tomorrowStart = new Date(startOfShanghaiDay(now).getTime() + DAY_MS);

  if (preset === "7d") {
    const startAt = new Date(startOfShanghaiDay(new Date(now.getTime() - 6 * DAY_MS)).getTime());
    return {
      preset,
      label: "近 7 天",
      startAt,
      endAt: tomorrowStart,
    };
  }

  if (preset === "month") {
    return {
      preset,
      label: "本月",
      startAt: startOfShanghaiMonth(now),
      endAt: tomorrowStart,
    };
  }

  if (preset === "custom") {
    const startRaw = input.start?.trim();
    const endRaw = input.end?.trim() || startRaw;
    if (!startRaw || !endRaw) {
      throw new Error("自定义时间范围需要开始和结束日期");
    }

    const startAt = startOfShanghaiDay(new Date(`${startRaw}T00:00:00+08:00`));
    const endStart = startOfShanghaiDay(new Date(`${endRaw}T00:00:00+08:00`));
    const endAt = new Date(endStart.getTime() + DAY_MS);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new Error("无效的日期格式");
    }

    if (endAt <= startAt) {
      throw new Error("结束日期必须大于或等于开始日期");
    }

    return {
      preset,
      label: `${startRaw} ~ ${endRaw}`,
      startAt,
      endAt,
    };
  }

  return {
    preset: "today",
    label: "今天",
    startAt: startOfShanghaiDay(now),
    endAt: tomorrowStart,
  };
}

export function formatDateRangeForInput(range: ResolvedDateRange): {
  start: string;
  end: string;
} {
  return {
    start: formatShanghaiDate(range.startAt),
    end: formatShanghaiDate(new Date(range.endAt.getTime() - DAY_MS)),
  };
}
