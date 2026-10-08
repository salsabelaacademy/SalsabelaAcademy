import { z } from "zod";
export const aiInput = z
  .object({
    language: z.enum(["en", "ar"]),
    messages: z
      .array(
        z
          .object({
            role: z.enum(["user", "model"]),
            text: z.string().trim().min(1).max(2000),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict()
  .refine(
    (v) =>
      v.messages.at(-1)?.role === "user" &&
      v.messages.reduce((n, m) => n + m.text.length, 0) <= 10000,
  );
export async function generateAnswer(
  body: z.infer<typeof aiInput>,
  send: typeof fetch = fetch,
  env = process.env,
) {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new Error("not_configured");
  const model = env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  if (!/^[a-z0-9.-]+$/.test(model)) throw new Error("not_configured");
  const response = await send(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: `You are Salsabela Academy's educational assistant. Answer in ${body.language === "ar" ? "Arabic" : "English"}. Help with Arabic study and lesson preparation. Do not invent academy policies, student records, prices, accreditation or access to private information. You cannot send messages, manage accounts or schedule lessons. Be concise. For religious rulings refer the student to their instructor. Never claim you are the instructor.`,
            },
          ],
        },
        contents: body.messages.map((m) => ({
          role: m.role,
          parts: [{ text: m.text }],
        })),
        generationConfig: {
          maxOutputTokens: 768,
          thinkingConfig:
            model.startsWith("gemini-2.5") && model.includes("flash")
              ? { thinkingBudget: 0 }
              : model.startsWith("gemini-3")
                ? { thinkingLevel: "low" }
                : undefined,
        },
      }),
    },
  );
  if (!response.ok)
    throw new Error(response.status === 429 ? "limited" : "ai_unavailable");
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts
    ?.filter((p: any) => !p.thought && typeof p.text === "string")
    .map((p: any) => p.text)
    .join("");
  if (!text) throw new Error("ai_unavailable");
  return text.slice(0, 8000);
}
