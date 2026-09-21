import { WEEKDAYS, timeLabel } from "./time";

/** Agrupa dias seguidos com os mesmos horários: "Terça a sexta" → "9h30, 10h30…" */
export function scheduleLines(slots: { weekday: number; time: string }[]) {
  const byDay = new Map<number, string[]>();
  for (const s of slots) byDay.set(s.weekday, [...(byDay.get(s.weekday) ?? []), s.time].sort());
  const days = [...byDay.keys()].sort((a, b) => a - b);
  const groups: { from: number; to: number; times: string[] }[] = [];
  for (const d of days) {
    const times = byDay.get(d)!;
    const last = groups[groups.length - 1];
    if (last && last.to === d - 1 && last.times.join() === times.join()) last.to = d;
    else groups.push({ from: d, to: d, times });
  }
  return groups.map((g) => ({
    label:
      g.from === g.to
        ? WEEKDAYS[g.from]
        : `${WEEKDAYS[g.from]} a ${WEEKDAYS[g.to].toLowerCase()}`,
    times: g.times.map(timeLabel).join(", "),
  }));
}
