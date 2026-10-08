import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Repeat2 } from "lucide-react";
import {
  expandRecurring,
  type RecurringInput,
} from "@shared/recurring-schedule";
import { conversationApi } from "@/lib/dashboard-api";
export function RecurringLessonForm({
  people,
  timezone,
  onDone,
}: {
  people: any[];
  timezone: string;
  onDone: () => void;
}) {
  const { t, i18n } = useTranslation(),
    tr = (k: string) => t("dashboardUpdate." + k);
  const [data, setData] = useState<RecurringInput>(() => ({
      requestKey: crypto.randomUUID(),
      title: "",
      studentId: 0,
      timezone,
      from: "",
      to: "",
      duration: 30,
      slots: [{ weekday: 6, time: "10:00" }],
    })),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (key: string, value: unknown) =>
    setData((previous) => ({ ...previous, [key]: value }));
  const preview = useMemo(() => {
    if (!data.from || !data.to) return { lessons: [], error: "" };
    try {
      return {
        lessons: expandRecurring({
          ...data,
          title: data.title || "Preview",
          studentId: data.studentId || 1,
        }),
        error: "",
      };
    } catch (e) {
      return {
        lessons: [],
        error:
          e instanceof Error &&
          ["dst_time", "schedule_conflict"].includes(e.message)
            ? e.message
            : "range",
      };
    }
  }, [data]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !preview.lessons.length || preview.error) return;
    setBusy(true);
    setError("");
    try {
      await conversationApi("/admin/lesson-series", "POST", data);
      onDone();
      setData((previous) => ({
        ...previous,
        requestKey: crypto.randomUUID(),
        from: "",
        to: "",
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="recurring-form" onSubmit={submit}>
      <h3>
        <Repeat2 size={20} />
        {tr("recurring")}
      </h3>
      <div className="recurring-fields">
        <label>
          {t("p4.student")}
          <select
            required
            value={data.studentId || ""}
            onChange={(e) => change("studentId", Number(e.target.value))}
          >
            <option value="">{t("p4.choose")}</option>
            {people
              .filter((p) => p.status === "active")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          {t("p4.title")}
          <input
            required
            maxLength={150}
            value={data.title}
            onChange={(e) => change("title", e.target.value)}
          />
        </label>
        <label>
          {tr("timezone")}
          <input
            required
            value={data.timezone}
            onChange={(e) => change("timezone", e.target.value)}
            list="schedule-zones"
          />
          <datalist id="schedule-zones">
            {[
              "UTC",
              "Africa/Cairo",
              "Asia/Riyadh",
              "Asia/Dubai",
              "Europe/London",
              "America/New_York",
              timezone,
            ].map((z, i) => (
              <option key={i} value={z} />
            ))}
          </datalist>
        </label>
        <label>
          {tr("duration")}
          <input
            type="number"
            min={15}
            max={180}
            required
            value={data.duration}
            onChange={(e) => change("duration", Number(e.target.value))}
          />
        </label>
        <label>
          {tr("from")}
          <input
            type="date"
            required
            value={data.from}
            onChange={(e) => change("from", e.target.value)}
          />
        </label>
        <label>
          {tr("to")}
          <input
            type="date"
            required
            value={data.to}
            onChange={(e) => change("to", e.target.value)}
          />
        </label>
      </div>
      <fieldset>
        <legend>{tr("recurring")}</legend>
        {data.slots.map((slot, index) => (
          <div className="recurring-slot" key={index}>
            <label>
              {tr("weekday")}
              <select
                value={slot.weekday}
                onChange={(e) =>
                  change(
                    "slots",
                    data.slots.map((s, i) =>
                      i === index
                        ? { ...s, weekday: Number(e.target.value) }
                        : s,
                    ),
                  )
                }
              >
                {Array.from({ length: 7 }, (_, day) => (
                  <option value={day} key={day}>
                    {new Date(Date.UTC(2026, 9, 4 + day)).toLocaleDateString(
                      i18n.language,
                      { weekday: "long", timeZone: "UTC" },
                    )}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr("time")}
              <input
                required
                type="time"
                value={slot.time}
                onChange={(e) =>
                  change(
                    "slots",
                    data.slots.map((s, i) =>
                      i === index ? { ...s, time: e.target.value } : s,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              aria-label={tr("remove")}
              disabled={data.slots.length === 1}
              onClick={() =>
                change(
                  "slots",
                  data.slots.filter((_, i) => i !== index),
                )
              }
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        <button
          className="p4-text-link"
          type="button"
          disabled={data.slots.length >= 7}
          onClick={() =>
            change("slots", [...data.slots, { weekday: 2, time: "19:00" }])
          }
        >
          <Plus size={18} />
          {tr("addSlot")}
        </button>
      </fieldset>
      {preview.lessons.length > 0 && (
        <section className="recurring-preview">
          <h4>
            {tr("preview")} ·{" "}
            {t("dashboardUpdate.count", { count: preview.lessons.length })}
          </h4>
          <p>{data.timezone}</p>
          <ol>
            {preview.lessons.map((lesson, i) => (
              <li key={i}>
                {lesson.startsAt.toLocaleString(i18n.language, {
                  timeZone: data.timezone,
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </li>
            ))}
          </ol>
        </section>
      )}
      {(error || preview.error) && (
        <p role="alert">
          {tr(
            ["range", "dst_time", "schedule_conflict"].includes(
              error || preview.error,
            )
              ? error || preview.error
              : "failed",
          )}
        </p>
      )}
      <button
        className="p4-button"
        disabled={busy || !preview.lessons.length || Boolean(preview.error)}
      >
        {busy ? t("p4.sending") : tr("createSeries")}
      </button>
    </form>
  );
}
