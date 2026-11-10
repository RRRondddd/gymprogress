import { test, expect } from "@playwright/test";
test("запись, восстановление, история, аналитика и офлайн", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Сильнее с каждой тренировкой." }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/gymprogress-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Начать тренировку", exact: true })
    .click();
  await page.getByRole("button", { name: "Свободная тренировка" }).click();
  await page
    .getByRole("button", { name: "Добавить упражнение", exact: true })
    .click();
  await page.getByRole("button", { name: "Жим лёжа Грудь" }).click();
  await page.getByLabel("Жим лёжа, подход 1, weight").fill("70");
  await page.getByLabel("Жим лёжа, подход 1, reps").fill("8");
  await page.getByLabel("Жим лёжа, подход 1, rir").fill("2");
  await page
    .getByRole("button", { name: "Выполнить подход", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Отменить выполнение" }),
  ).toBeVisible();
  await page.reload();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Тренировка", exact: true })
    .click();
  await expect(page.getByLabel("Жим лёжа, подход 1, weight")).toHaveValue("70");
  await expect(
    page.getByRole("button", { name: "Отменить выполнение" }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/gymprogress-workout.png",
    fullPage: true,
  });
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Завершить тренировку", exact: true })
    .click();
  await expect(page.locator(".history-card")).toContainText("Жим лёжа");
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Прогресс", exact: true })
    .click();
  await expect(
    page.getByText("70 кг × 8 повторений", { exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForTimeout(1500);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Сильнее с каждой тренировкой." }),
  ).toBeVisible();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "История", exact: true })
    .click();
  await expect(page.locator(".history-card")).toContainText("Жим лёжа");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Открыть / изменить" }).click();
  await page.getByLabel("Жим лёжа, подход 1, weight").fill("75");
  await page
    .getByRole("button", { name: "Выполнить подход", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Прогресс", exact: true })
    .click();
  await expect(
    page.getByText("75 кг × 8 повторений", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "История", exact: true })
    .click();
  await page.getByLabel("Удалить тренировку").click();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Прогресс", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Первые данные ещё впереди" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("программа, редактирование, копия шаблона и резервная копия", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("button", { name: "Создать программу", exact: true })
    .click();
  await page.getByLabel("Название", { exact: true }).fill("Upper / Lower");
  await page
    .getByRole("button", { name: "Добавить упражнение", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Приседания со штангой Ноги" })
    .click();
  await page.getByRole("button", { name: "Сохранить программу" }).click();
  await expect(page.locator(".program-card")).toContainText("Upper / Lower");
  await page
    .getByRole("button", { name: "Начать тренировку", exact: true })
    .click();
  await page.getByRole("button", { name: "День 1 1 упражнений" }).click();
  await page.getByLabel("Приседания со штангой, подход 1, weight").fill("22,5");
  await page.getByLabel("Приседания со штангой, подход 1, reps").fill("10");
  await page
    .getByRole("button", { name: "Выполнить подход", exact: true })
    .first()
    .click();
  page.on("dialog", (d) => d.accept());
  await page.getByLabel("Удалить упражнение").click();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Главная", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Редактировать", exact: true })
    .click();
  await page.getByRole("button", { name: "Upper / Lower 1 дней" }).click();
  await expect(
    page.getByRole("heading", { name: "Приседания со штангой" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Сохранить программу" }).click();
  await page
    .getByRole("button", { name: "Настройки", exact: true })
    .first()
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт JSON" }).click();
  const dl = await download;
  const path = await dl.path();
  await page.locator("input[type=file]").setInputFiles(path!);
  await expect(
    page.getByRole("heading", { name: "Сильнее с каждой тренировкой." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".program-card")).toContainText("Upper / Lower");
});
test("десктоп и узкий экран", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Сильнее с каждой тренировкой." }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/gymprogress-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
