import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content, `conteúdo ${dimensions.content}px em viewport ${dimensions.viewport}px`).toBeLessThanOrEqual(
    dimensions.viewport + 1
  );
}

test("páginas públicas navegam sem estouro horizontal", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Aurora Studio", level: 1 })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const mobileMenu = page.getByLabel("Abrir menu");
  if (await mobileMenu.isVisible()) await mobileMenu.click();
  await page.getByRole("link", { name: "Trabalhos", exact: true }).click();
  await expect(page).toHaveURL(/\/galeria/);
  await expect(page.getByRole("heading", { name: "Trabalhos", level: 1 })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/agendar");
  await expect(page.getByRole("heading", { name: "Agendar horário", level: 1 })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("login administrativo permanece utilizável", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
