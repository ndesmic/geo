import { test, expect } from "@playwright/test";

test("Should resize canvas", async ({ page }) => {
    await page.goto("http://localhost:4507/visual-tests/should-resize-canvas/should-resize-canvas.html");
    await expect(page).toHaveTitle("Geo - Should resize canvas");
    const canvas = await page.locator("canvas");
    await expect(canvas).toHaveScreenshot();
    const select = page.locator("#select-change-resolution");
    select.selectOption({ value: "hd" });
    await expect(canvas).toHaveScreenshot();
});