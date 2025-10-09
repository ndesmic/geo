import { test, expect } from "@playwright/test";

test("Should transform group mesh nested", async ({ page }) => {
    await page.goto("http://localhost:4507/visual-tests/should-transform-group-mesh/should-transform-group-mesh-nested.html");
    await expect(page).toHaveTitle("Geo - Should transform group mesh nested");
    const rendered = await page.locator(".rendered");
    expect(rendered).toBeVisible();
    const canvas = await page.locator("canvas");
    await expect(canvas).toHaveScreenshot();
});