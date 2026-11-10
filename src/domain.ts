export type Exercise = {
  id: string;
  name: string;
  muscle: string;
  load: "free" | "machine" | "body";
  unit: "кг";
  additionalWeight: boolean;
  unilateral: boolean;
};
export type SetEntry = {
  id: string;
  weight: string;
  reps: string;
  rir: string;
  warmup: boolean;
  done: boolean;
  side: "" | "Л" | "П";
};
export type Movement = {
  id: string;
  exerciseId: string;
  name: string;
  load: Exercise["load"];
  sets: SetEntry[];
  min: number;
  max: number;
};
export type Day = { id: string; name: string; exercises: Movement[] };
export type Program = { id: string; name: string; days: Day[] };
export type Workout = {
  id: string;
  name: string;
  start: number;
  end?: number;
  exercises: Movement[];
};
export type State = {
  version: 1;
  exercises: Exercise[];
  programs: Program[];
  history: Workout[];
  active: Workout | null;
  settings: { rest: number; autoRest: boolean; notify: boolean };
  timer: { end: number | null; remaining: number };
};
export const uid = () => crypto.randomUUID();
const names: [string, string, Exercise["load"]][] = [
  ["Приседания со штангой", "Ноги", "free"],
  ["Жим лёжа", "Грудь", "free"],
  ["Становая тяга", "Спина", "free"],
  ["Румынская тяга", "Ноги", "free"],
  ["Жим ногами", "Ноги", "machine"],
  ["Сгибание ног", "Ноги", "machine"],
  ["Разгибание ног", "Ноги", "machine"],
  ["Подтягивания", "Спина", "body"],
  ["Отжимания", "Грудь", "body"],
  ["Тяга верхнего блока", "Спина", "machine"],
  ["Горизонтальная тяга", "Спина", "machine"],
  ["Жим гантелей", "Плечи", "free"],
  ["Разведения гантелей", "Плечи", "free"],
  ["Подъёмы на бицепс", "Руки", "free"],
  ["Разгибания на трицепс", "Руки", "machine"],
  ["Гиперэкстензия", "Спина", "body"],
  ["Пистолетики", "Ноги", "body"],
  ["Сисси-приседания", "Ноги", "body"],
];
export const initial = (): State => ({
  version: 1,
  exercises: names.map(([name, muscle, load], i) => ({
    id: `ex-${i}`,
    name,
    muscle,
    load,
    unit: "кг",
    additionalWeight: true,
    unilateral: i === 16,
  })),
  programs: [],
  history: [],
  active: null,
  settings: { rest: 90, autoRest: true, notify: false },
  timer: { end: null, remaining: 0 },
});
export const newSet = (): SetEntry => ({
  id: uid(),
  weight: "",
  reps: "",
  rir: "",
  warmup: false,
  done: false,
  side: "",
});
export const movement = (e: Exercise): Movement => ({
  id: uid(),
  exerciseId: e.id,
  name: e.name,
  load: e.load,
  sets: [newSet(), newSet(), newSet()],
  min: 8,
  max: 12,
});
export function number(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
export function validSet(s: SetEntry) {
  const w = number(s.weight),
    r = number(s.reps),
    rir = number(s.rir);
  return (
    w !== null &&
    w >= 0 &&
    r !== null &&
    Number.isInteger(r) &&
    r >= (s.done ? 1 : 0) &&
    (s.rir === "" || (rir !== null && rir >= 0 && rir <= 10))
  );
}
export const working = (m: Movement) =>
  m.sets.filter((s) => s.done && !s.warmup && validSet(s));
export const volume = (m: Movement) =>
  working(m).reduce((v, s) => v + number(s.weight)! * number(s.reps)!, 0);
export function e1rm(weight: number, reps: number, body = false) {
  return body || weight <= 0 || reps < 1 || reps > 10 || !Number.isInteger(reps)
    ? null
    : reps === 1
      ? weight
      : weight * (1 + reps / 30);
}
export function records(history: Workout[], id: string) {
  const ms = history.flatMap((w) =>
    w.exercises.filter((m) => m.exerciseId === id),
  );
  const sets = ms.flatMap((m) =>
    working(m).map((s) => ({ s, body: m.load === "body" })),
  );
  if (!sets.length) return null;
  const repByWeight: Record<string, number> = {};
  for (const { s } of sets) {
    const key = String(number(s.weight));
    repByWeight[key] = Math.max(repByWeight[key] || 0, number(s.reps)!);
  }
  return {
    weight: Math.max(...sets.map(({ s }) => number(s.weight)!)),
    reps: Math.max(...sets.map(({ s }) => number(s.reps)!)),
    repByWeight,
    e1rm: Math.max(
      0,
      ...sets.map(
        ({ s, body }) => e1rm(number(s.weight)!, number(s.reps)!, body) || 0,
      ),
    ),
    volume: Math.max(
      ...history.map((w) =>
        w.exercises
          .filter((m) => m.exerciseId === id)
          .reduce((v, m) => v + volume(m), 0),
      ),
    ),
  };
}
export function startWorkout(
  name: string,
  exercises: Movement[] = [],
): Workout {
  return {
    id: uid(),
    name,
    start: Date.now(),
    exercises: structuredClone(exercises).map((m) => ({
      ...m,
      id: uid(),
      sets: m.sets.map(() => newSet()),
    })),
  };
}
export const previous = (history: Workout[], id: string, before = Infinity) =>
  [...history]
    .filter((w) => (w.end || 0) < before)
    .sort((a, b) => (b.end || 0) - (a.end || 0))
    .flatMap((w) =>
      w.exercises.filter(
        (m) => m.exerciseId === id && m.sets.some((s) => s.done),
      ),
    )
    .at(0);
export function finish(w: Workout): Workout {
  const exercises = w.exercises
    .map((m) => ({ ...m, sets: m.sets.filter((s) => s.done) }))
    .filter((m) => m.sets.length);
  if (!exercises.length) throw Error("Нет выполненных подходов");
  if (exercises.some((m) => m.sets.some((s) => !validSet(s))))
    throw Error("Проверьте вес, повторения и RIR");
  return { ...structuredClone(w), exercises, end: w.end || Date.now() };
}
export function parseBackup(text: string): State {
  const d = JSON.parse(text);
  const str = (x: unknown) => typeof x === "string";
  const finite = (x: unknown) => typeof x === "number" && Number.isFinite(x);
  const set = (s: any) => {
    if (
      !s ||
      !str(s.id) ||
      !str(s.weight) ||
      !str(s.reps) ||
      !str(s.rir) ||
      typeof s.done !== "boolean" ||
      typeof s.warmup !== "boolean" ||
      !["", "Л", "П"].includes(s.side)
    )
      return false;
    if (s.done) return validSet(s);
    const w = number(s.weight),
      r = number(s.reps),
      rir = number(s.rir);
    return (
      (s.weight === "" || (w !== null && w >= 0)) &&
      (s.reps === "" || (r !== null && r >= 0 && Number.isInteger(r))) &&
      (s.rir === "" || (rir !== null && rir >= 0 && rir <= 10))
    );
  };
  const move = (m: any) =>
    m &&
    str(m.id) &&
    str(m.exerciseId) &&
    str(m.name) &&
    ["free", "machine", "body"].includes(m.load) &&
    finite(m.min) &&
    finite(m.max) &&
    m.min >= 0 &&
    m.max >= m.min &&
    Array.isArray(m.sets) &&
    m.sets.every(set);
  const workout = (w: any) =>
    w &&
    str(w.id) &&
    str(w.name) &&
    finite(w.start) &&
    (w.end === undefined || (finite(w.end) && w.end >= w.start)) &&
    Array.isArray(w.exercises) &&
    w.exercises.every(move);
  if (
    !d ||
    d.version !== 1 ||
    !Array.isArray(d.exercises) ||
    !d.exercises.every(
      (e: any) =>
        e &&
        str(e.id) &&
        str(e.name) &&
        str(e.muscle) &&
        ["free", "machine", "body"].includes(e.load) &&
        e.unit === "кг" &&
        typeof e.additionalWeight === "boolean" &&
        typeof e.unilateral === "boolean",
    ) ||
    !Array.isArray(d.programs) ||
    !d.programs.every(
      (p: any) =>
        p &&
        str(p.id) &&
        str(p.name) &&
        Array.isArray(p.days) &&
        p.days.every(
          (day: any) =>
            day &&
            str(day.id) &&
            str(day.name) &&
            Array.isArray(day.exercises) &&
            day.exercises.every(move),
        ),
    ) ||
    !Array.isArray(d.history) ||
    !d.history.every((w: any) => workout(w) && finite(w.end)) ||
    !(d.active === null || (workout(d.active) && d.active.end === undefined)) ||
    !d.settings ||
    !finite(d.settings.rest) ||
    d.settings.rest < 1 ||
    typeof d.settings.autoRest !== "boolean" ||
    typeof d.settings.notify !== "boolean" ||
    !d.timer ||
    !(d.timer.end === null || finite(d.timer.end)) ||
    !finite(d.timer.remaining) ||
    d.timer.remaining < 0
  )
    throw Error("Неверная структура или версия резервной копии");
  return d;
}
