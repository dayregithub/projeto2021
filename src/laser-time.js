// UI syntax only. Stored quotes keep numeric decimal minutes for compatibility.
export function parseLaserTime(value) {
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return Number(text);
  const compact = /^(\d+)[,.](\d{2})$/.exec(text);
  if (compact)
    return Number(compact[2]) < 60
      ? Number(compact[1]) + Number(compact[2]) / 60
      : NaN;
  const parts = text.split(":");
  if (
    parts.length < 2 ||
    parts.length > 3 ||
    parts.some((part) => !/^\d+$/.test(part))
  )
    return NaN;
  const numbers = parts.map(Number);
  const seconds = numbers.at(-1);
  if (seconds >= 60 || (parts.length === 3 && numbers[1] >= 60)) return NaN;
  return parts.length === 3
    ? numbers[0] * 60 + numbers[1] + seconds / 60
    : numbers[0] + seconds / 60;
}
export const LASER_TIME_HELP =
  "Use 1,30 ou 00:01:30 para 1 min e 30 s. Um número inteiro representa minutos. Após a vírgula, use dois dígitos de segundos, de 00 a 59.";
