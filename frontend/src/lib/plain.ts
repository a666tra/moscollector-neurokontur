import { PredictionItem } from '../types';

/** Human wording for model factors: first a plain phrase, then the technical term. */
const PLAIN: Array<[RegExp, string]> = [
  [/Дребезг/i, 'датчик сам по себе часто срабатывает'],
  [/Молчание/i, 'датчик долго не выходил на связь'],
  [/Сброс часов/i, 'у контроллера сбились часы'],
  [/питани|батаре/i, 'у датчика садится питание'],
  [/метан|газ/i, 'в тоннеле фиксировали газ'],
  [/темп|перегрев/i, 'растёт температура'],
  [/Штатные колебания/i, 'показания в норме, но ритм сообщений необычный'],
];
export const plainReason = (t: string) => (PLAIN.find(([r]) => r.test(t)) || [null, 'необычное поведение датчика'])[1];

export const LEVEL_TEXT: Record<string, string> = {
  CRITICAL: 'Срочно проверить', WARNING: 'Проверить скоро', ATTENTION: 'Наблюдать', NORMAL: 'Норма',
};
export const LEVEL_VAR: Record<string, string> = {
  CRITICAL: 'var(--cr)', WARNING: 'var(--wr)', ATTENTION: 'var(--at)', NORMAL: 'var(--ok)',
};
export const LEVEL_SOFT: Record<string, string> = {
  CRITICAL: 'var(--crs)', WARNING: 'var(--wrs)', ATTENTION: 'var(--ats)', NORMAL: 'var(--oks)',
};

export const probabilityOf = (p: PredictionItem) =>
  typeof p.calibrated_proxy_probability === 'number' ? p.calibrated_proxy_probability : p.failure_probability;

/** «[Охранная зона]ДП Ленинский» → «Охранная зона · ДП Ленинский» */
export const cleanName = (n: string) => (n || '').replace(/^\[([^\]]+)\]\s*/, '$1 · ').replace(/\s+/g, ' ').trim();
/** Short title for lists: drop the zone prefix. */
export const shortName = (n: string) => cleanName(n).replace(/^[^·]+·\s*/, '') || cleanName(n);
