import { test, expect } from "@playwright/test";

test("Should render background", async ({ page }) => {
    await page.goto("http://localhost:4507/visual-tests/should-render-background/should-render-background.html");
    await expect(page).toHaveTitle("Geo - Should render background");
    const canvas = await page.locator("canvas");
    await expect(canvas).toHaveScreenshot();
});