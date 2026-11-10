import { describe, it, expect, afterEach } from "vitest";
import "fake-indexeddb/auto";
import {
  initial,
  movement,
  newSet,
  validSet,
  number,
  volume,
  e1rm,
  records,
  startWorkout,
  finish,
  parseBackup,
  previous,
} from "./domain";
import { Database } from "./storage";
describe("Расчёты и валидация", () => {
  it("различает пустое значение и ноль, принимает запятую", () => {
    expect(number("")).toBeNull();
    expect(number("0")).toBe(0);
    expect(number("22,5")).toBe(22.5);
    expect(number("Infinity")).toBeNull();
  });
  it("валидирует повторения, RIR, вес и выполненный подход", () => {
    const s = { ...newSet(), weight: "0", reps: "1", done: true };
    expect(validSet(s)).toBe(true);
    for (const patch of [
      { weight: "-1" },
      { reps: "0" },
      { reps: "1.5" },
      { rir: "11" },
      { rir: "-1" },
      { weight: "" },
    ])
      expect(validSet({ ...s, ...patch })).toBe(false);
    expect(validSet({ ...s, rir: "0" })).toBe(true);
  });
  it("считает объём только выполненных рабочих подходов без удвоения стороны", () => {
    const m = movement(initial().exercises[0]);
    m.sets = [
      { ...newSet(), weight: "22,5", reps: "8", done: true, side: "Л" },
      { ...newSet(), weight: "100", reps: "10", warmup: true, done: true },
      { ...newSet(), weight: "100", reps: "10" },
    ];
    expect(volume(m)).toBe(180);
  });
  it("Эпли: одиночный повтор, допустимый диапазон, собственный вес", () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(60, 10)).toBe(80);
    expect(e1rm(60, 11)).toBeNull();
    expect(e1rm(0, 8)).toBeNull();
    expect(e1rm(10, 8, true)).toBeNull();
  });
  it("отделяет текущую тренировку от программы", () => {
    const m = movement(initial().exercises[0]),
      w = startWorkout("A", [m]);
    w.exercises[0].name = "B";
    w.exercises[0].sets[0].weight = "80";
    expect(m.name).not.toBe("B");
    expect(m.sets[0].weight).toBe("");
  });
  it("завершает только выполненные упражнения, пересчитывает рекорды после удаления", () => {
    const m = movement(initial().exercises[0]),
      w = startWorkout("A", [m]);
    expect(() => finish(w)).toThrow();
    w.exercises[0].sets[0] = {
      ...newSet(),
      weight: "60",
      reps: "10",
      done: true,
    };
    const done = finish(w);
    expect(done.exercises[0].sets).toHaveLength(1);
    expect(records([done], m.exerciseId)).toMatchObject({
      weight: 60,
      e1rm: 80,
      volume: 600,
      repByWeight: { "60": 10 },
    });
    expect(records([], m.exerciseId)).toBeNull();
    expect(previous([done], m.exerciseId)).toBeDefined();
    expect(previous([done], m.exerciseId, w.start)).toBeUndefined();
  });
});
describe("Резервные копии и IndexedDB", () => {
  it("экспорт/импорт без потери данных", () => {
    const d = initial();
    d.active = startWorkout("Свободная");
    d.active.exercises.push(movement(d.exercises[0]));
    expect(parseBackup(JSON.stringify(d))).toEqual(d);
  });
  it("отклоняет повреждённые и несовместимые файлы", () => {
    for (const s of [
      "bad",
      "null",
      "{}",
      JSON.stringify({ ...initial(), version: 2 }),
      JSON.stringify({ ...initial(), settings: { rest: -2 } }),
    ])
      expect(() => parseBackup(s)).toThrow();
    const d = initial();
    d.active = startWorkout("X", [movement(d.exercises[0])]);
    d.active.exercises[0].sets[0].rir = "99";
    expect(() => parseBackup(JSON.stringify(d))).toThrow();
  });
  const db = new Database("test-gym");
  afterEach(async () => {
    await db.snapshots.clear();
  });
  it("восстанавливает активную тренировку и абсолютный таймер из БД", async () => {
    const d = initial();
    d.active = startWorkout("Сохранённая");
    d.timer = { end: Date.now() + 90000, remaining: 90 };
    await db.snapshots.put({ id: "main", data: d });
    db.close();
    await db.open();
    expect((await db.snapshots.get("main"))?.data).toEqual(d);
  });
});
