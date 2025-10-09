import { test, expect } from "@playwright/test";

test("Should render teapot", async ({ page }) => {
    await page.goto("http://localhost:4507/visual-tests/should-render-teapot/should-render-teapot.html");
    await expect(page).toHaveTitle("Geo - Should render teapot");
    const canvas = await page.locator("canvas");
    await expect(canvas).toHaveScreenshot();
});