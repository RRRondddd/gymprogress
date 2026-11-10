import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Dumbbell,
  House,
  ChartNoAxesCombined,
  History,
  Settings,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Check,
  X,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  Play,
  Pause,
  Timer,
  Download,
  Upload,
  Flame,
  Target,
  Trophy,
  CalendarDays,
  WifiOff,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  initial,
  uid,
  movement,
  newSet,
  validSet,
  number,
  volume,
  records,
  previous,
  startWorkout,
  finish,
  parseBackup,
  working,
  type State,
  type Workout,
  type Movement,
  type Program,
  type Exercise,
} from "./domain";
import { load, save } from "./storage";
const fmt = (n: number) =>
  new Intl.NumberFormat("ru", { maximumFractionDigits: 1 }).format(n);
const date = (n: number) =>
  new Date(n).toLocaleDateString("ru", { day: "numeric", month: "long" });
const clock = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;
function Button({
  children,
  onClick,
  secondary = false,
  ...props
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      className={secondary ? "button secondary" : "button"}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Dumbbell size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    node?.querySelector<HTMLElement>("button,input,select")?.focus();
    const handle = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== node) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
      }
      if (event.key === "Tab") {
        const elements = Array.from(
          node!.querySelectorAll<HTMLElement>(
            "button,input:not([hidden]),select,summary",
          ),
        ).filter((e) => e.offsetParent !== null);
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, []);
  return (
    <div className="overlay" onClick={close}>
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="Закрыть" onClick={close}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export default function App() {
  const [data, setData] = useState<State>(initial),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [page, setPage] = useState("Главная"),
    [modal, setModal] = useState(""),
    [editProgram, setEditProgram] = useState<Program | null>(null),
    [editWorkout, setEditWorkout] = useState<Workout | null>(null),
    [picker, setPicker] = useState<{
      target: "workout" | "program";
      day?: string;
      replace?: string;
    } | null>(null),
    [search, setSearch] = useState(""),
    [muscle, setMuscle] = useState("Все"),
    [now, setNow] = useState(Date.now()),
    [exerciseId, setExerciseId] = useState("ex-1"),
    [period, setPeriod] = useState(90),
    [metric, setMetric] = useState("weight"),
    [calendar, setCalendar] = useState(false),
    [month, setMonth] = useState(new Date().toISOString().slice(0, 7)),
    [selectedDate, setSelectedDate] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [newName, setNewName] = useState(""),
    [newMuscle, setNewMuscle] = useState("Ноги"),
    [newLoad, setNewLoad] = useState<Exercise["load"]>("free"),
    [unilateral, setUnilateral] = useState(false);
  const current = useRef(data),
    queue = useRef(Promise.resolve()),
    notified = useRef(false),
    file = useRef<HTMLInputElement>(null);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    load()
      .then((d) => {
        current.current = d;
        setData(d);
        setReady(true);
      })
      .catch(() =>
        setError(
          "Не удалось открыть локальное хранилище. Разрешите хранение данных в браузере и перезагрузите страницу.",
        ),
      );
    const t = setInterval(() => setNow(Date.now()), 1000);
    const net = () => setOnline(navigator.onLine);
    addEventListener("online", net);
    addEventListener("offline", net);
    return () => {
      clearInterval(t);
      removeEventListener("online", net);
      removeEventListener("offline", net);
    };
  }, []);
  function commit(next: State, optimistic = true) {
    if (!ready) return Promise.reject(Error("Хранилище недоступно"));
    if (optimistic) {
      current.current = next;
      setData(next);
    }
    const task = queue.current
      .then(() => save(next))
      .then(() => {
        if (!optimistic) {
          current.current = next;
          setData(next);
        }
      });
    queue.current = task.catch(() => {});
    return task.catch(() => {
      setError(
        "Не удалось сохранить данные. Не закрывайте приложение: экспортируйте резервную копию и повторите сохранение.",
      );
      throw Error("Ошибка сохранения");
    });
  }
  function change(fn: (s: State) => void) {
    const d = structuredClone(current.current);
    fn(d);
    void commit(d).catch(() => {});
  }
  const remaining = data.timer.end
    ? Math.max(0, Math.ceil((data.timer.end - now) / 1000))
    : data.timer.remaining;
  useEffect(() => {
    if (data.timer.end && remaining === 0 && !notified.current) {
      notified.current = true;
      if (data.settings.notify) {
        navigator.vibrate?.([200, 100, 200]);
        try {
          const ctx = new AudioContext();
          const o = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0.15;
          o.connect(gain);
          gain.connect(ctx.destination);
          o.start();
          o.stop(ctx.currentTime + 0.25);
          o.onended = () => void ctx.close();
        } catch {
          /* Device may require an active gesture. */
        }
      }
    }
  }, [remaining, data.timer.end, data.settings.notify]);
  function timer(seconds = data.settings.rest) {
    notified.current = false;
    change((d) => {
      d.timer = { end: Date.now() + seconds * 1000, remaining: seconds };
    });
  }
  function start(name = "Свободная тренировка", ms: Movement[] = []) {
    if (data.active) {
      setPage("Тренировка");
      setModal("");
      return;
    }
    change((d) => {
      d.active = startWorkout(name, ms);
    });
    setPage("Тренировка");
    setModal("");
  }
  const workout = editWorkout || data.active;
  function updateWorkout(fn: (w: Workout) => void) {
    if (editWorkout) {
      const w = structuredClone(editWorkout);
      fn(w);
      setEditWorkout(w);
    } else
      change((d) => {
        if (d.active) fn(d.active);
      });
  }
  function choose(e: Exercise) {
    if (!picker) return;
    const m = movement(e);
    if (picker.target === "workout")
      updateWorkout((w) => {
        if (picker.replace) {
          const i = w.exercises.findIndex((x) => x.id === picker.replace);
          w.exercises[i] = m;
        } else w.exercises.push(m);
      });
    else if (editProgram) {
      const p = structuredClone(editProgram);
      p.days.find((d) => d.id === picker.day)!.exercises.push(m);
      setEditProgram(p);
    }
    setPicker(null);
    setSearch("");
  }
  function reorder<T>(list: T[], i: number, dir: number) {
    const j = i + dir;
    if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
  }
  async function complete() {
    if (!workout) return;
    if (
      !editWorkout &&
      !workout.exercises.some((m) => m.sets.some((s) => s.done))
    ) {
      if (
        confirm(
          "Выполненных подходов нет. Отменить пустую тренировку? Нажми «Отмена», чтобы вернуться к записи.",
        )
      ) {
        const d = structuredClone(current.current);
        d.active = null;
        d.timer = { end: null, remaining: 0 };
        await commit(d, false)
          .then(() => setPage("Главная"))
          .catch(() => {});
      }
      return;
    }
    try {
      const done = finish(workout);
      const count = done.exercises.reduce((n, m) => n + m.sets.length, 0);
      if (
        !confirm(
          `${editWorkout ? "Сохранить изменения" : "Завершить тренировку"}?\n${done.exercises.length} упражнений · ${count} выполненных подходов`,
        )
      )
        return;
      const d = structuredClone(current.current);
      if (editWorkout)
        d.history = d.history.map((w) => (w.id === done.id ? done : w));
      else {
        d.history.push(done);
        d.active = null;
        d.timer = { end: null, remaining: 0 };
      }
      await commit(d, false);
      setEditWorkout(null);
      setPage("История");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function saveTemplate(w: Workout) {
    const name = prompt("Название программы", w.name);
    if (!name?.trim()) return;
    change((d) => {
      d.programs.push({
        id: uid(),
        name: name.trim(),
        days: [
          {
            id: uid(),
            name: "День 1",
            exercises: w.exercises.map((m) => ({
              ...structuredClone(m),
              id: uid(),
              sets: m.sets.map(() => newSet()),
            })),
          },
        ],
      });
    });
  }
  function exportData() {
    const blob = new Blob([JSON.stringify(current.current, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `gymprogress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const recent = [...data.history].sort((a, b) => b.end! - a.end!),
    week = data.history.filter(
      (w) => w.end! > Date.now() - 7 * 86400000,
    ).length;
  const points = [...data.history]
    .sort((a, b) => a.end! - b.end!)
    .filter((w) => period === 0 || w.end! >= now - period * 86400000)
    .flatMap((w) => {
      const ms = w.exercises.filter((m) => m.exerciseId === exerciseId),
        ss = ms.flatMap(working);
      return ss.length
        ? [
            {
              date: date(w.end!),
              weight: Math.max(...ss.map((s) => number(s.weight)!)),
              volume: ms.reduce((n, m) => n + volume(m), 0),
              reps: ss.reduce((n, s) => n + number(s.reps)!, 0),
            },
          ]
        : [];
    });
  const pr = records(data.history, exerciseId);
  const nav = [
    { name: "Главная", icon: House },
    { name: "Тренировка", icon: Dumbbell },
    { name: "Прогресс", icon: ChartNoAxesCombined },
    { name: "История", icon: History },
  ];
  function renderWorkout(w: Workout) {
    return (
      <>
        <div className="section-title">
          <div>
            <span className="eyebrow">
              {editWorkout ? "ЗАВЕРШЁННАЯ ТРЕНИРОВКА" : "В ПРОЦЕССЕ"}
            </span>
            <input
              className="title-input"
              aria-label="Название тренировки"
              value={w.name}
              onChange={(e) =>
                updateWorkout((w) => {
                  w.name = e.target.value;
                })
              }
            />
            <p>
              Начало{" "}
              {new Date(w.start).toLocaleTimeString("ru", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              <span className="dot">•</span>{" "}
              {clock(Math.max(0, ((w.end || now) - w.start) / 1000))}
            </p>
          </div>
          <span className="tag">
            {w.exercises.reduce(
              (n, m) => n + m.sets.filter((s) => s.done).length,
              0,
            )}{" "}
            подходов
          </span>
        </div>
        {w.exercises.map((m, i) => {
          const prev = previous(
            data.history.filter((x) => x.id !== w.id),
            m.exerciseId,
            w.start,
          );
          return (
            <article className="card exercise" key={m.id}>
              <header>
                <div className="exercise-number">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="grow">
                  <h3>{m.name}</h3>
                  <p>
                    {m.min}–{m.max} повторений{" "}
                    {m.load === "body" ? "· только дополнительный вес" : ""}
                  </p>
                </div>
                <button
                  aria-label="Выше"
                  onClick={() =>
                    updateWorkout((w) => reorder(w.exercises, i, -1))
                  }
                >
                  <ChevronUp size={18} />
                </button>
                <button
                  aria-label="Ниже"
                  onClick={() =>
                    updateWorkout((w) => reorder(w.exercises, i, 1))
                  }
                >
                  <ChevronDown size={18} />
                </button>
                <button
                  aria-label="Удалить упражнение"
                  onClick={() => {
                    if (confirm("Удалить упражнение и его подходы?"))
                      updateWorkout((w) => {
                        w.exercises.splice(i, 1);
                      });
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </header>
              <div className="previous">
                {prev
                  ? "Прошлый раз: " +
                    prev.sets
                      .filter((s) => s.done)
                      .map(
                        (s) =>
                          `${s.weight} кг × ${s.reps}${s.rir !== "" ? `, RIR ${s.rir}` : ""}`,
                      )
                      .join(" / ")
                  : "Первая запись этого упражнения"}
              </div>
              <div className="sets-label">
                <span>ТИП</span>
                <span>КГ</span>
                <span>ПОВТ.</span>
                <span>RIR</span>
                <span>СТ.</span>
                <span>ГОТОВО</span>
                <span />
              </div>
              {m.sets.map((s, j) => (
                <div
                  className={`set-row ${s.done ? "completed" : ""}`}
                  key={s.id}
                >
                  <button
                    className="set-type"
                    title="Переключить рабочий / разминочный"
                    onClick={() =>
                      updateWorkout((w) => {
                        w.exercises[i].sets[j].warmup = !s.warmup;
                      })
                    }
                  >
                    {s.warmup ? "Р" : j + 1}
                  </button>
                  {(["weight", "reps", "rir"] as const).map((field) => (
                    <input
                      key={field}
                      aria-label={`${m.name}, подход ${j + 1}, ${field}`}
                      inputMode={field === "reps" ? "numeric" : "decimal"}
                      placeholder="—"
                      value={s[field]}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateWorkout((w) => {
                          w.exercises[i].sets[j][field] = v;
                          w.exercises[i].sets[j].done = false;
                        });
                      }}
                    />
                  ))}
                  <select
                    aria-label="Сторона"
                    value={s.side}
                    onChange={(e) =>
                      updateWorkout((w) => {
                        w.exercises[i].sets[j].side = e.target.value as
                          "" | "Л" | "П";
                      })
                    }
                  >
                    <option value="">—</option>
                    <option>Л</option>
                    <option>П</option>
                  </select>
                  <button
                    className={s.done ? "check active" : "check"}
                    aria-label={
                      s.done ? "Отменить выполнение" : "Выполнить подход"
                    }
                    onClick={() => {
                      if (!s.done && !validSet({ ...s, done: true })) {
                        setError(
                          "Укажите вес ≥ 0, целое число повторений ≥ 1 и RIR от 0 до 10.",
                        );
                        return;
                      }
                      updateWorkout((w) => {
                        w.exercises[i].sets[j].done = !s.done;
                      });
                      if (!s.done && !editWorkout && data.settings.autoRest)
                        timer();
                    }}
                  >
                    <Check size={19} />
                  </button>
                  <button
                    aria-label="Удалить подход"
                    onClick={() =>
                      updateWorkout((w) => {
                        w.exercises[i].sets.splice(j, 1);
                      })
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <footer>
                <button
                  className="text-button"
                  onClick={() =>
                    updateWorkout((w) => {
                      w.exercises[i].sets.push(newSet());
                    })
                  }
                >
                  <Plus size={16} /> Добавить подход
                </button>
                <button
                  className="muted"
                  onClick={() =>
                    setPicker({ target: "workout", replace: m.id })
                  }
                >
                  Заменить
                </button>
              </footer>
            </article>
          );
        })}
        <Button secondary onClick={() => setPicker({ target: "workout" })}>
          <Plus size={18} /> Добавить упражнение
        </Button>
        <div className="workout-actions">
          <Button onClick={() => void complete()}>
            <Check size={18} />
            {editWorkout ? "Сохранить изменения" : "Завершить тренировку"}
          </Button>
          {editWorkout ? (
            <Button secondary onClick={() => setEditWorkout(null)}>
              Отменить изменения
            </Button>
          ) : (
            <button
              className="muted"
              onClick={() => {
                if (
                  confirm("Отменить тренировку? Все её подходы будут удалены.")
                ) {
                  change((d) => {
                    d.active = null;
                    d.timer = { end: null, remaining: 0 };
                  });
                  setPage("Главная");
                }
              }}
            >
              Отменить тренировку
            </button>
          )}
        </div>
      </>
    );
  }
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setPage("Главная")}>
          <span className="brand-icon">
            <Dumbbell size={25} />
          </span>
          GYMPROGRESS<span className="brand-dot">.</span>
        </a>
        <span className="sidebar-label">ТВОЯ СИЛА В ЦИФРАХ</span>
        <nav>
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={page === name ? "selected" : ""}
              onClick={() => {
                setPage(name);
                setEditWorkout(null);
              }}
            >
              <Icon size={21} />
              {name}
              {name === "Тренировка" && data.active && (
                <span className="live-dot" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-badge">
            <span /> Всё хранится на устройстве
          </div>
          <button onClick={() => setModal("settings")}>
            <Settings size={19} /> Настройки
          </button>
          <small>FORGE SYSTEM / v1.0</small>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>ЛИЧНЫЙ ДНЕВНИК ТРЕНИРОВОК</span>
          <div>
            {!online && (
              <span className="tag">
                <WifiOff size={14} /> Офлайн
              </span>
            )}
            <span className="today">
              {new Date(now).toLocaleDateString("ru", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <button aria-label="Настройки" onClick={() => setModal("settings")}>
              <Settings size={20} />
            </button>
          </div>
        </header>
        <main>
          {error && (
            <div role="alert" className="error">
              {error}
              <div>
                <button
                  onClick={() =>
                    void commit(current.current)
                      .then(() => setError(""))
                      .catch(() => {})
                  }
                >
                  Повторить сохранение
                </button>
                <button
                  onClick={() => setError("")}
                  aria-label="Закрыть ошибку"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}
          {needRefresh && (
            <div className="notice">
              Доступна новая версия. Данные сохранены на устройстве.{" "}
              <button onClick={() => void updateServiceWorker(true)}>
                Обновить
              </button>
            </div>
          )}
          {!ready ? (
            <Empty
              title="Открываем дневник"
              text="Подключение к локальному хранилищу…"
            />
          ) : (
            <>
              {page === "Главная" && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        КАЖДЫЙ ПОДХОД ИМЕЕТ ЗНАЧЕНИЕ
                      </span>
                      <h1>
                        Сильнее с каждой
                        <br className="mobile-break" /> тренировкой
                        <span className="accent">.</span>
                      </h1>
                      <p>
                        Твой прогресс начинается здесь. Продолжай двигаться.
                      </p>
                    </div>
                    <button
                      className="icon-box"
                      aria-label="Программы"
                      onClick={() => setModal("programs")}
                    >
                      <Dumbbell size={28} />
                    </button>
                  </div>
                  <div className="stats-grid">
                    <div className="stat card">
                      <span>
                        <Flame size={18} /> ЗА ПОСЛЕДНИЕ 7 ДНЕЙ
                      </span>
                      <div>
                        {week}
                        <small> тренировок</small>
                      </div>
                      <p>Каждая тренировка — шаг вперёд</p>
                    </div>
                    <div className="stat card">
                      <span>
                        <Target size={18} /> ВСЕГО ТРЕНИРОВОК
                      </span>
                      <div>
                        {data.history.length}
                        <small> завершено</small>
                      </div>
                      <p>Твоя работа. Твоя история.</p>
                    </div>
                    <div className="stat card">
                      <span>
                        <CalendarDays size={18} /> ПОСЛЕДНЯЯ ТРЕНИРОВКА
                      </span>
                      <div className="stat-date">
                        {recent[0] ? date(recent[0].end!) : "Ещё впереди"}
                      </div>
                      <p>{recent[0]?.name || "Самое время начать"}</p>
                    </div>
                  </div>
                  <section className="start-card">
                    <div className="hero-lines" />
                    <div className="hero-content">
                      <span className="eyebrow">
                        {data.active
                          ? "ТРЕНИРОВКА УЖЕ НАЧАТА"
                          : "ТВОЙ СЛЕДУЮЩИЙ ШАГ"}
                      </span>
                      <h2>
                        {data.active
                          ? "Вернись к тренировке"
                          : "Готов стать сильнее?"}
                      </h2>
                      <p>
                        {data.active
                          ? data.active.name
                          : "Выбери программу или начни в своём ритме."}
                      </p>
                      <Button
                        onClick={() =>
                          data.active
                            ? setPage("Тренировка")
                            : setModal("start")
                        }
                      >
                        <Play size={18} fill="currentColor" />
                        {data.active
                          ? "Продолжить тренировку"
                          : "Начать тренировку"}
                        <ArrowUpRight size={18} />
                      </Button>
                    </div>
                    <Dumbbell className="hero-dumbbell" strokeWidth={1.1} />
                    <span className="hero-caption">SHOW UP. GET STRONGER.</span>
                  </section>
                  <div className="dashboard-columns">
                    <section>
                      <div className="section-title">
                        <h2>
                          Твои программы{" "}
                          <span className="count">{data.programs.length}</span>
                        </h2>
                        <button
                          className="text-button"
                          onClick={() => setModal("programs")}
                        >
                          Редактировать <ArrowUpRight size={16} />
                        </button>
                      </div>
                      {data.programs.length ? (
                        data.programs.map((p) => (
                          <button
                            className="program-card card"
                            key={p.id}
                            onClick={() => {
                              setModal("start");
                            }}
                          >
                            <span className="exercise-number">
                              <Dumbbell size={22} />
                            </span>
                            <div>
                              <h3>{p.name}</h3>
                              <p>{p.days.length} тренировочных дней</p>
                            </div>
                            <ArrowRight size={20} />
                          </button>
                        ))
                      ) : (
                        <div className="card empty-program">
                          <span className="outlined-icon">
                            <Dumbbell size={26} />
                          </span>
                          <h3>Твой план. Твой результат.</h3>
                          <p>
                            Создай программу и тренируйся
                            <br />
                            последовательно, день за днём.
                          </p>
                          <Button
                            secondary
                            onClick={() => {
                              setEditProgram({
                                id: uid(),
                                name: "Новая программа",
                                days: [
                                  { id: uid(), name: "День 1", exercises: [] },
                                ],
                              });
                              setModal("editor");
                            }}
                          >
                            <Plus size={18} /> Создать программу
                          </Button>
                        </div>
                      )}
                    </section>
                    <section>
                      <div className="section-title">
                        <h2>Последняя активность</h2>
                        <button
                          className="text-button"
                          onClick={() => setPage("История")}
                        >
                          Вся история <ArrowUpRight size={16} />
                        </button>
                      </div>
                      {recent[0] ? (
                        <div className="card activity">
                          <span className="eyebrow">
                            {date(recent[0].end!)}
                          </span>
                          <h3>{recent[0].name}</h3>
                          <p>
                            {recent[0].exercises.length} упражнений ·{" "}
                            {clock((recent[0].end! - recent[0].start) / 1000)}
                          </p>
                          <Button
                            secondary
                            onClick={() => {
                              setEditWorkout(structuredClone(recent[0]));
                              setPage("Тренировка");
                            }}
                          >
                            Открыть тренировку <ArrowRight size={17} />
                          </Button>
                        </div>
                      ) : (
                        <div className="card empty-program">
                          <span className="outlined-icon">
                            <History size={26} />
                          </span>
                          <h3>Здесь начнётся твоя история</h3>
                          <p>
                            Заверши первую тренировку,
                            <br />и мы сохраним каждый подход.
                          </p>
                          <span className="subtle-tag">
                            БОЛЬШИЕ РЕЗУЛЬТАТЫ НАЧИНАЮТСЯ С МАЛОГО
                          </span>
                        </div>
                      )}
                    </section>
                  </div>
                  {data.history.length > 0 && (
                    <section className="recent-records">
                      {[
                        ...new Set(
                          recent.flatMap((w) =>
                            w.exercises.map((m) => m.exerciseId),
                          ),
                        ),
                      ]
                        .slice(0, 3)
                        .map((id) => {
                          const r = records(data.history, id);
                          const m = recent
                            .flatMap((w) => w.exercises)
                            .find((m) => m.exerciseId === id);
                          return (
                            r && (
                              <div className="card activity" key={id}>
                                <span className="eyebrow">ЛИЧНЫЙ РЕКОРД</span>
                                <h3>{m?.name}</h3>
                                <p>
                                  {fmt(r.weight)} кг · до {r.reps} повторений
                                </p>
                                <button
                                  className="text-button"
                                  onClick={() => {
                                    setExerciseId(id);
                                    setPage("Прогресс");
                                  }}
                                >
                                  Подробнее <ArrowUpRight size={16} />
                                </button>
                              </div>
                            )
                          );
                        })}
                    </section>
                  )}
                  <section className="records-strip">
                    <Trophy size={24} />
                    <div>
                      <h3>
                        {data.history.length
                          ? "Твои лучшие результаты"
                          : "Личные рекорды ждут тебя"}
                      </h3>
                      <p>
                        {data.history.length
                          ? "Следи за весом, повторениями и объёмом каждого упражнения."
                          : "Записывай подходы — отслеживай свои лучшие результаты."}
                      </p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setPage("Прогресс")}
                    >
                      К прогрессу <ArrowRight size={17} />
                    </button>
                  </section>
                </>
              )}
              {page === "Тренировка" &&
                (workout ? (
                  renderWorkout(workout)
                ) : (
                  <>
                    <div className="page-heading">
                      <h1>
                        Тренировка<span className="accent">.</span>
                      </h1>
                    </div>
                    <Empty
                      title="Время для нового подхода"
                      text="Начни свободную тренировку или выбери день программы."
                    >
                      <Button onClick={() => setModal("start")}>
                        <Play size={18} /> Начать тренировку
                      </Button>
                    </Empty>
                  </>
                ))}
              {page === "Прогресс" && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">РЕЗУЛЬТАТ ТВОЕЙ РАБОТЫ</span>
                      <h1>
                        Прогресс<span className="accent">.</span>
                      </h1>
                      <p>Сравнивай себя только с собой.</p>
                    </div>
                  </div>
                  <div className="filters">
                    <select
                      aria-label="Упражнение для аналитики"
                      value={exerciseId}
                      onChange={(e) => setExerciseId(e.target.value)}
                    >
                      {data.exercises.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Период"
                      value={period}
                      onChange={(e) => setPeriod(Number(e.target.value))}
                    >
                      <option value={30}>30 дней</option>
                      <option value={90}>90 дней</option>
                      <option value={365}>1 год</option>
                      <option value={0}>Всё время</option>
                    </select>
                  </div>
                  <div className="card chart-card">
                    <div className="tabs">
                      {[
                        ["weight", "Рабочий вес"],
                        ["volume", "Объём"],
                        ["reps", "Повторения"],
                      ].map(([v, l]) => (
                        <button
                          key={v}
                          className={metric === v ? "selected" : ""}
                          onClick={() => setMetric(v)}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    {points.length ? (
                      <>
                        <p>
                          {metric === "weight"
                            ? "Максимальный внешний вес, кг"
                            : metric === "volume"
                              ? "Рабочий объём, кг · повт."
                              : "Сумма рабочих повторений"}
                        </p>
                        <ResponsiveContainer width="100%" height={280}>
                          <LineChart data={points}>
                            <CartesianGrid stroke="#34383B" vertical={false} />
                            <XAxis
                              dataKey="date"
                              stroke="#A1A5A9"
                              fontSize={11}
                            />
                            <YAxis stroke="#A1A5A9" width={48} />
                            <Tooltip
                              contentStyle={{
                                background: "#24272A",
                                border: "1px solid #34383B",
                                borderRadius: 8,
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey={metric}
                              name={
                                metric === "weight"
                                  ? "Вес"
                                  : metric === "volume"
                                    ? "Объём"
                                    : "Повторения"
                              }
                              stroke="#DB7545"
                              strokeWidth={3}
                              dot={{ r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </>
                    ) : (
                      <Empty
                        title="Первые данные ещё впереди"
                        text="Выполни рабочие подходы этого упражнения и заверши тренировку."
                      />
                    )}
                  </div>
                  {pr && (
                    <>
                      <h2>Личные рекорды</h2>
                      <div className="stats-grid">
                        <div className="card stat">
                          <span>МАКСИМАЛЬНЫЙ ВНЕШНИЙ ВЕС</span>
                          <div>
                            {fmt(pr.weight)}
                            <small> кг</small>
                          </div>
                        </div>
                        <div className="card stat">
                          <span>ЛУЧШИЙ E1RM</span>
                          <div>
                            {pr.e1rm ? fmt(pr.e1rm) : "—"}
                            <small>{pr.e1rm ? " кг" : ""}</small>
                          </div>
                        </div>
                        <div className="card stat">
                          <span>ОБЪЁМ ЗА ТРЕНИРОВКУ</span>
                          <div>
                            {fmt(pr.volume)}
                            <small> кг · повт.</small>
                          </div>
                        </div>
                      </div>
                      <div className="card activity">
                        <h3>Рекорды повторений при каждом весе</h3>
                        {Object.entries(pr.repByWeight).map(([w, r]) => (
                          <p key={w}>
                            {w} кг × {r} повторений
                          </p>
                        ))}
                      </div>
                    </>
                  )}
                  <p className="help">
                    e1RM — ориентировочная оценка по формуле Эпли для 1–10
                    повторений. Для собственного веса не рассчитывается. Масса
                    тела не прибавляется; для таких упражнений ориентируйся на
                    подходы и повторения.
                  </p>
                </>
              )}
              {page === "История" && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">КАЖДЫЙ ПОДХОД СОХРАНЁН</span>
                      <h1>
                        История<span className="accent">.</span>
                      </h1>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => setCalendar(!calendar)}
                    >
                      <CalendarDays size={18} />
                      {calendar ? "Список" : "Календарь"}
                    </button>
                  </div>
                  {calendar && (
                    <div className="card activity">
                      <label>
                        Месяц{" "}
                        <input
                          type="month"
                          value={month}
                          onChange={(e) => {
                            setMonth(e.target.value);
                            setSelectedDate("");
                          }}
                        />
                      </label>
                      <div className="calendar">
                        {month &&
                          Array.from(
                            {
                              length: new Date(
                                Number(month.slice(0, 4)),
                                Number(month.slice(5)),
                                0,
                              ).getDate(),
                            },
                            (_, i) => {
                              const key = `${month}-${String(i + 1).padStart(2, "0")}`;
                              const has = recent.some(
                                (w) =>
                                  new Date(w.end!).toLocaleDateString(
                                    "sv-SE",
                                  ) === key,
                              );
                              return (
                                <button
                                  key={key}
                                  className={`${has ? "has-workout" : ""} ${selectedDate === key ? "selected" : ""}`}
                                  onClick={() =>
                                    setSelectedDate(
                                      selectedDate === key ? "" : key,
                                    )
                                  }
                                >
                                  {i + 1}
                                  {has && <span />}
                                </button>
                              );
                            },
                          )}
                      </div>
                    </div>
                  )}
                  {recent
                    .filter(
                      (w) =>
                        !calendar ||
                        new Date(w.end!)
                          .toLocaleDateString("sv-SE")
                          .startsWith(selectedDate || month),
                    )
                    .map((w) => (
                      <article className="card history-card" key={w.id}>
                        <span className="eyebrow">{date(w.end!)}</span>
                        <h3>{w.name}</h3>
                        <p>
                          {w.exercises.length} упражнений ·{" "}
                          {w.exercises.reduce((n, m) => n + m.sets.length, 0)}{" "}
                          подходов · {clock((w.end! - w.start) / 1000)}
                        </p>
                        <div className="history-exercises">
                          {w.exercises.map((m) => (
                            <span key={m.id}>{m.name}</span>
                          ))}
                        </div>
                        <div className="actions">
                          <Button
                            secondary
                            onClick={() => {
                              setEditWorkout(structuredClone(w));
                              setPage("Тренировка");
                            }}
                          >
                            Открыть / изменить
                          </Button>
                          <button
                            className="text-button"
                            onClick={() => saveTemplate(w)}
                          >
                            В программу
                          </button>
                          <button
                            aria-label="Удалить тренировку"
                            onClick={() => {
                              if (
                                confirm(
                                  "Удалить тренировку из истории? Рекорды будут пересчитаны.",
                                )
                              )
                                change((d) => {
                                  d.history = d.history.filter(
                                    (x) => x.id !== w.id,
                                  );
                                });
                            }}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </article>
                    ))}
                  {!recent.length && (
                    <Empty
                      title="Твоя история начинается с первой тренировки"
                      text="Здесь будут упражнения, подходы и результаты каждого занятия."
                    />
                  )}
                </>
              )}
            </>
          )}
        </main>
        <footer className="page-footer">
          <span>
            GYMPROGRESS <b> / </b> FORGE YOUR PROGRESS
          </span>
          <span>Локально. Приватно. Только твоё.</span>
        </footer>
      </div>
      <nav className="bottom-nav">
        {nav.map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={page === name ? "selected" : ""}
            onClick={() => {
              setPage(name);
              setEditWorkout(null);
            }}
          >
            <Icon size={21} />
            <span>{name}</span>
          </button>
        ))}
      </nav>
      {ready && data.active && (
        <div className="rest-bar">
          <Timer size={20} />
          <strong>{clock(remaining)}</strong>
          <span className="rest-label">Отдых</span>
          <button
            aria-label={data.timer.end ? "Пауза" : "Запустить таймер"}
            onClick={() =>
              data.timer.end
                ? change((d) => {
                    d.timer = { end: null, remaining };
                  })
                : timer(remaining || data.settings.rest)
            }
          >
            {data.timer.end ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            aria-label="Остановить таймер"
            onClick={() =>
              change((d) => {
                d.timer = { end: null, remaining: 0 };
              })
            }
          >
            <X size={17} />
          </button>
          {[60, 90, 120, 180].map((s) => (
            <button key={s} className="quick-rest" onClick={() => timer(s)}>
              {s}с
            </button>
          ))}
        </div>
      )}
      {modal === "start" && (
        <Modal title="Начать тренировку" close={() => setModal("")}>
          <Button onClick={() => start()}>
            <Plus size={18} /> Свободная тренировка
          </Button>
          <h3>По программе</h3>
          {data.programs.length ? (
            data.programs.map((p) => (
              <section key={p.id}>
                <h4>{p.name}</h4>
                {p.days.map((d) => (
                  <button
                    className="choice"
                    key={d.id}
                    onClick={() => start(`${p.name} · ${d.name}`, d.exercises)}
                  >
                    <span>
                      {d.name}
                      <small>{d.exercises.length} упражнений</small>
                    </span>
                    <ArrowRight size={18} />
                  </button>
                ))}
              </section>
            ))
          ) : (
            <p className="muted">Программ пока нет. Создай свою на главной.</p>
          )}
        </Modal>
      )}
      {modal === "programs" && (
        <Modal title="Твои программы" close={() => setModal("")}>
          <Button
            onClick={() => {
              setEditProgram({
                id: uid(),
                name: "Новая программа",
                days: [{ id: uid(), name: "День 1", exercises: [] }],
              });
              setModal("editor");
            }}
          >
            <Plus size={18} /> Создать программу
          </Button>
          {data.programs.map((p) => (
            <div className="choice" key={p.id}>
              <button
                className="grow"
                onClick={() => {
                  setEditProgram(structuredClone(p));
                  setModal("editor");
                }}
              >
                {p.name}
                <small>{p.days.length} дней</small>
              </button>
              <button
                aria-label="Удалить программу"
                onClick={() => {
                  if (
                    confirm("Удалить программу? История тренировок останется.")
                  )
                    change((d) => {
                      d.programs = d.programs.filter((x) => x.id !== p.id);
                    });
                }}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </Modal>
      )}
      {modal === "editor" && editProgram && (
        <Modal
          title="Редактор программы"
          close={() => {
            if (confirm("Закрыть без сохранения изменений?")) {
              setModal("");
              setEditProgram(null);
            }
          }}
        >
          <label>
            Название
            <input
              value={editProgram.name}
              onChange={(e) =>
                setEditProgram({ ...editProgram, name: e.target.value })
              }
            />
          </label>
          {editProgram.days.map((d, i) => (
            <div className="day-editor card" key={d.id}>
              <div className="row">
                <input
                  aria-label="Название дня"
                  value={d.name}
                  onChange={(e) => {
                    const p = structuredClone(editProgram);
                    p.days[i].name = e.target.value;
                    setEditProgram(p);
                  }}
                />
                <button
                  title="День выше"
                  onClick={() => {
                    const p = structuredClone(editProgram);
                    reorder(p.days, i, -1);
                    setEditProgram(p);
                  }}
                >
                  <ChevronUp size={17} />
                </button>
                <button
                  title="День ниже"
                  onClick={() => {
                    const p = structuredClone(editProgram);
                    reorder(p.days, i, 1);
                    setEditProgram(p);
                  }}
                >
                  <ChevronDown size={17} />
                </button>
                <button
                  title="Дублировать день"
                  onClick={() => {
                    const p = structuredClone(editProgram);
                    p.days.push({
                      ...structuredClone(d),
                      id: uid(),
                      name: d.name + " (копия)",
                    });
                    setEditProgram(p);
                  }}
                >
                  <Copy size={17} />
                </button>
                <button
                  title="Удалить день"
                  onClick={() => {
                    const p = structuredClone(editProgram);
                    p.days.splice(i, 1);
                    setEditProgram(p);
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
              {d.exercises.map((m, j) => (
                <div className="template-exercise" key={m.id}>
                  <h4>{m.name}</h4>
                  <div className="template-controls">
                    {[
                      ["Подходы", m.sets.length],
                      ["От", m.min],
                      ["До", m.max],
                    ].map(([l, v], k) => (
                      <label key={l}>
                        {l}
                        <input
                          type="number"
                          min={k === 0 ? 1 : 0}
                          max={k === 0 ? 30 : 100}
                          value={v}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (
                              !Number.isInteger(n) ||
                              n < (k === 0 ? 1 : 0) ||
                              n > (k === 0 ? 30 : 100)
                            )
                              return;
                            const p = structuredClone(editProgram),
                              x = p.days[i].exercises[j];
                            if (k === 0)
                              x.sets = Array.from({ length: n }, () =>
                                newSet(),
                              );
                            else if (k === 1) x.min = n;
                            else x.max = n;
                            setEditProgram(p);
                          }}
                        />
                      </label>
                    ))}
                    <button
                      title="Упражнение выше"
                      onClick={() => {
                        const p = structuredClone(editProgram);
                        reorder(p.days[i].exercises, j, -1);
                        setEditProgram(p);
                      }}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      title="Упражнение ниже"
                      onClick={() => {
                        const p = structuredClone(editProgram);
                        reorder(p.days[i].exercises, j, 1);
                        setEditProgram(p);
                      }}
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      title="Удалить упражнение"
                      onClick={() => {
                        const p = structuredClone(editProgram);
                        p.days[i].exercises.splice(j, 1);
                        setEditProgram(p);
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="text-button"
                onClick={() => setPicker({ target: "program", day: d.id })}
              >
                <Plus size={17} /> Добавить упражнение
              </button>
            </div>
          ))}
          <Button
            secondary
            onClick={() =>
              setEditProgram({
                ...editProgram,
                days: [
                  ...editProgram.days,
                  {
                    id: uid(),
                    name: `День ${editProgram.days.length + 1}`,
                    exercises: [],
                  },
                ],
              })
            }
          >
            <Plus size={17} /> Добавить день
          </Button>
          <Button
            onClick={() => {
              if (
                !editProgram.name.trim() ||
                !editProgram.days.length ||
                editProgram.days.some(
                  (d) =>
                    !d.name.trim() || d.exercises.some((m) => m.min > m.max),
                )
              ) {
                setError(
                  "Укажи название программы, хотя бы один день и корректный диапазон повторений.",
                );
                return;
              }
              change((d) => {
                const i = d.programs.findIndex((p) => p.id === editProgram.id);
                if (i < 0) d.programs.push(editProgram);
                else d.programs[i] = editProgram;
              });
              setModal("");
              setEditProgram(null);
            }}
          >
            <Check size={17} /> Сохранить программу
          </Button>
        </Modal>
      )}
      {picker && (
        <Modal title="Каталог упражнений" close={() => setPicker(null)}>
          <input
            autoFocus
            aria-label="Поиск упражнения"
            placeholder="Найти упражнение…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="chips">
            {["Все", "Ноги", "Грудь", "Спина", "Плечи", "Руки"].map((m) => (
              <button
                key={m}
                className={muscle === m ? "selected" : ""}
                onClick={() => setMuscle(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="catalog">
            {data.exercises
              .filter(
                (e) =>
                  e.name.toLowerCase().includes(search.toLowerCase()) &&
                  (muscle === "Все" || muscle === e.muscle),
              )
              .map((e) => (
                <button className="choice" key={e.id} onClick={() => choose(e)}>
                  <span>
                    {e.name}
                    <small>
                      {e.muscle} ·{" "}
                      {e.load === "body"
                        ? "Свой вес"
                        : e.load === "machine"
                          ? "Тренажёр"
                          : "Свободный вес"}
                      {e.unilateral ? " · Л / П" : ""}
                    </small>
                  </span>
                  <Plus size={18} />
                </button>
              ))}
          </div>
          <details>
            <summary>Создать своё упражнение</summary>
            <label>
              Название
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <label>
              Мышечная группа
              <input
                value={newMuscle}
                onChange={(e) => setNewMuscle(e.target.value)}
              />
            </label>
            <label>
              Тип нагрузки
              <select
                value={newLoad}
                onChange={(e) => setNewLoad(e.target.value as Exercise["load"])}
              >
                <option value="free">Свободный вес</option>
                <option value="machine">Тренажёр</option>
                <option value="body">Свой вес</option>
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={unilateral}
                onChange={(e) => setUnilateral(e.target.checked)}
              />{" "}
              Одностороннее упражнение
            </label>
            <Button
              onClick={() => {
                if (!newName.trim() || !newMuscle.trim()) return;
                const e: Exercise = {
                  id: uid(),
                  name: newName.trim(),
                  muscle: newMuscle.trim(),
                  load: newLoad,
                  unit: "кг",
                  additionalWeight: true,
                  unilateral,
                };
                change((d) => {
                  d.exercises.push(e);
                });
                choose(e);
                setNewName("");
              }}
            >
              Создать и добавить
            </Button>
          </details>
        </Modal>
      )}
      {modal === "settings" && (
        <Modal title="Настройки" close={() => setModal("")}>
          <h3>Отдых между подходами</h3>
          <label>
            Продолжительность, секунды
            <input
              type="number"
              min={1}
              max={3600}
              value={data.settings.rest}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n > 0 && n <= 3600)
                  change((d) => {
                    d.settings.rest = n;
                  });
              }}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={data.settings.autoRest}
              onChange={(e) =>
                change((d) => {
                  d.settings.autoRest = e.target.checked;
                })
              }
            />{" "}
            Запускать после выполнения подхода
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={data.settings.notify}
              onChange={(e) =>
                change((d) => {
                  d.settings.notify = e.target.checked;
                })
              }
            />{" "}
            Звук и вибрация, если доступны
          </label>
          <p className="help">
            В фоне и при блокировке телефона уведомление не гарантируется. Время
            отдыха восстановится при открытии приложения.
          </p>
          <h3>Резервное копирование</h3>
          <p className="help">
            Данные находятся только в этом браузере. Регулярно сохраняй копию:
            очистка данных сайта удалит дневник.
          </p>
          <Button secondary onClick={exportData}>
            <Download size={18} /> Экспорт JSON
          </Button>
          <Button secondary onClick={() => file.current?.click()}>
            <Upload size={18} /> Импорт JSON
          </Button>
          <input
            hidden
            type="file"
            ref={file}
            accept="application/json,.json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                if (f.size > 20 * 1024 * 1024)
                  throw Error("Файл слишком большой (максимум 20 МБ)");
                const d = parseBackup(await f.text());
                if (
                  confirm(
                    `Заменить все данные резервной копией?\n${d.history.length} тренировок, ${d.programs.length} программ. Сначала экспортируй текущий дневник.`,
                  )
                ) {
                  await commit(d, false);
                  setEditWorkout(null);
                  setPage("Главная");
                  setModal("");
                }
              } catch (err) {
                setError((err as Error).message);
              }
              e.target.value = "";
            }}
          />
          <h3>Установка на телефон</h3>
          <p className="help">
            Android: меню браузера → «Установить приложение». iPhone: Safari →
            «Поделиться» → «На экран Домой». После первой загрузки приложение
            доступно офлайн.
          </p>
        </Modal>
      )}
    </div>
  );
}
