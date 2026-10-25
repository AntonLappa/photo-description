// Общие помощники для обеих функций. Файлы с "_" Vercel не делает эндпоинтами.

export const MAX_PHOTOS = 10;
export const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024; // одно фото после сжатия на телефоне

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// Простой пароль: если APP_PASSWORD задан в Vercel, без него запросы не проходят.
export function checkPassword(request) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return true;
  return request.headers.get("x-app-password") === expected;
}

// Достаёт фото из multipart/form-data (поле "photos"), проверяет количество и размер.
export async function readPhotos(form) {
  const files = form.getAll("photos").filter((f) => f && typeof f.arrayBuffer === "function");
  if (!files.length) throw new UserError("Нет фото.");
  if (files.length > MAX_PHOTOS) throw new UserError(`Максимум ${MAX_PHOTOS} фото.`);

  const photos = [];
  for (const f of files) {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) throw new UserError("Поддерживаются только JPEG, PNG и WebP.");
    if (f.size > MAX_PHOTO_BYTES) throw new UserError("Одно из фото слишком большое.");
    photos.push({ mimeType: f.type, buffer: Buffer.from(await f.arrayBuffer()) });
  }
  return photos;
}

export class UserError extends Error {}
