import { z } from "zod";
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  });
export const recurringInput = z
  .object({
    requestKey: z.string().uuid(),
    studentId: z.coerce.number().int().positive(),
    programId: z.coerce.number().int().positive().optional(),
    title: z.string().trim().min(1).max(150),
    timezone: z
      .string()
      .max(80)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }),
    from: day,
    to: day,
    duration: z.coerce.number().int().min(15).max(180),
    slots: z
      .array(
        z
          .object({
            weekday: z.number().int().min(0).max(6),
            time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
          })
          .strict(),
      )
      .min(1)
      .max(7),
  })
  .strict();
export type RecurringInput = z.infer<typeof recurringInput>;
function wallParts(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (name: string) =>
    Number(parts.find((p) => p.type === name)?.value);
  return Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );
}
/** Reject nonexistent or ambiguous DST wall times, rather than silently shifting a lesson. */
export function wallToUtc(date: string, time: string, zone: string) {
  const wall = new Date(date + "T" + time + ":00Z").getTime(),
    offsets = new Set<number>();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const sample = wall + hours * 3600000;
    offsets.add(wallParts(new Date(sample), zone) - sample);
  }
  const matches = Array.from(offsets)
    .map((offset) => wall - offset)
    .filter((candidate) => wallParts(new Date(candidate), zone) === wall);
  if (matches.length !== 1) throw new Error("dst_time");
  return new Date(matches[0]);
}
export function expandRecurring(input: RecurringInput) {
  const value = recurringInput.parse(input),
    from = new Date(value.from + "T00:00:00Z").getTime(),
    to = new Date(value.to + "T00:00:00Z").getTime();
  if (to < from || to - from > 83 * 86400000) throw new Error("range");
  const lessons: { startsAt: Date; endsAt: Date }[] = [];
  for (let date = from; date <= to; date += 86400000) {
    const d = new Date(date);
    for (const slot of value.slots.filter((s) => s.weekday === d.getUTCDay())) {
      const startsAt = wallToUtc(
        d.toISOString().slice(0, 10),
        slot.time,
        value.timezone,
      );
      lessons.push({
        startsAt,
        endsAt: new Date(startsAt.getTime() + value.duration * 60000),
      });
    }
  }
  lessons.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  if (!lessons.length || lessons.length > 60) throw new Error("range");
  for (let i = 1; i < lessons.length; i++)
    if (lessons[i].startsAt < lessons[i - 1].endsAt)
      throw new Error("schedule_conflict");
  return lessons;
}
