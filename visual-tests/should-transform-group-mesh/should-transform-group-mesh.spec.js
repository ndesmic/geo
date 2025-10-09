import { test, expect } from "@playwright/test";

test("Should transform group mesh", async ({ page }) => {
    await page.goto("http://localhost:4507/visual-tests/should-transform-group-mesh/should-transform-group-mesh.html");
    await expect(page).toHaveTitle("Geo - Should transform group mesh");
    const canvas = await page.locator("canvas");
    const rendered = await page.locator(".rendered");
    expect(rendered).toBeVisible();
    await expect(canvas).toHaveScreenshot();
});