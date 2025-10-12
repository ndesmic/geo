import { test, expect } from "@playwright/test";

test("Should render background color", async ({ page }) => {
    await page.goto("http://localhost:4507/visual-tests/should-render-background-color/should-render-background-color.html");
    await expect(page).toHaveTitle("Geo - Should render background color");
    const canvas = await page.locator("canvas");
    await expect(canvas).toHaveScreenshot();
});