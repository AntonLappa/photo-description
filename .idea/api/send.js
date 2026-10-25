// POST /api/send
// Отправляет готовое (уже проверенное) описание и фото на почту из MAIL_TO.

import { Resend } from "resend";
import { json, checkPassword, readPhotos, UserError } from "./_shared.js";

function subjectFrom(text) {
  // Берём первую непустую строку ("Название: ..."), без названия поля
  const first = text.split("\n").map((s) => s.trim()).find(Boolean) || "Описание";
  const clean = first.replace(/^[^:]{1,30}:\s*/, "") || first;
  return clean.slice(0, 120);
}

export async function POST(request) {
  if (!checkPassword(request)) return json(401, { error: "Неверный пароль." });
  const { RESEND_API_KEY, MAIL_TO } = process.env;
  if (!RESEND_API_KEY || !MAIL_TO) return json(500, { error: "На сервере не заданы RESEND_API_KEY и MAIL_TO." });

  try {
    const form = await request.formData();
    const photos = await readPhotos(form);
    const text = String(form.get("text") || "").slice(0, 20000).trim();
    if (!text) throw new UserError("Описание пустое.");

    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.MAIL_FROM || "ФотоОпис <onboarding@resend.dev>",
      to: MAIL_TO.split(",").map((s) => s.trim()).filter(Boolean),
      subject: subjectFrom(text),
      text,
      attachments: photos.map((p, i) => ({
        filename: `foto-${String(i + 1).padStart(2, "0")}.jpg`,
        content: p.buffer,
      })),
    });

    if (error) {
      console.error("resend error:", error);
      return json(502, { error: "Почтовый сервис отказал: " + (error.message || "неизвестная ошибка") });
    }
    return json(200, { ok: true, to: MAIL_TO });
  } catch (e) {
    if (e instanceof UserError) return json(400, { error: e.message });
    console.error("send failed:", e);
    return json(500, { error: "Не удалось отправить письмо. Попробуйте ещё раз." });
  }
}
