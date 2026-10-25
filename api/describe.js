// POST /api/describe
// Принимает фото + шаблон + заметки, возвращает описание от Gemini.

import { GoogleGenAI } from "@google/genai";
import { json, checkPassword, readPhotos, UserError } from "./_shared.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const LANGS = ["Русский", "Deutsch", "Українська", "English"];

function buildPrompt({ template, notes, lang }) {
  return `Ты помогаешь продавцу б/у промышленного оборудования. На приложенных фото один товар (станок, оборудование или инструмент), снятый с разных сторон.

Задача: заполни шаблон описания по фото. Язык ответа: ${lang}. Если язык не русский, переведи и названия полей шаблона.

Правила:
1. Определи тип оборудования, производителя и модель. Текст с шильдика/таблички (модель, год, серийный номер, мощность, напряжение и т.п.) переписывай точно как на фото.
2. Не придумывай характеристики. Если значения нет на фото и в данных от продавца, пиши «[уточнить]». Если что-то определено по внешнему виду, но не наверняка, добавь «(предположительно)».
3. Состояние оценивай только по видимому: следы износа, ржавчина, комплектность, чистота.
4. Пиши деловым языком для объявления о продаже, без восклицательных знаков и рекламных преувеличений.
5. Выведи только заполненный шаблон обычным текстом, без markdown-разметки (без **, #) и без вступлений.
${notes ? `\nДанные от продавца (им доверяй больше, чем догадкам по фото):\n${notes}\n` : ""}
Шаблон:
${template}`;
}

export async function POST(request) {
  if (!checkPassword(request)) return json(401, { error: "Неверный пароль." });
  if (!process.env.GEMINI_API_KEY) return json(500, { error: "На сервере не задан GEMINI_API_KEY." });

  try {
    const form = await request.formData();
    const photos = await readPhotos(form);
    const template = String(form.get("template") || "").slice(0, 8000).trim();
    const notes = String(form.get("notes") || "").slice(0, 4000).trim();
    const lang = LANGS.includes(form.get("lang")) ? form.get("lang") : "Русский";
    if (!template) throw new UserError("Шаблон пустой.");

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: buildPrompt({ template, notes, lang }) },
            ...photos.map((p) => ({
              inlineData: { mimeType: p.mimeType, data: p.buffer.toString("base64") },
            })),
          ],
        },
      ],
    });

    const text = (result.text || "").trim();
    if (!text) return json(502, { error: "ИИ вернул пустой ответ. Попробуйте ещё раз или добавьте фото шильдика." });
    return json(200, { text });
  } catch (e) {
    if (e instanceof UserError) return json(400, { error: e.message });
    console.error("describe failed:", e);
    const status = e?.status || e?.code;
    if (status === 429) return json(429, { error: "Лимит Gemini исчерпан. Подождите минуту и попробуйте снова." });
    return json(500, { error: "Не удалось получить описание. Попробуйте ещё раз." });
  }
}
