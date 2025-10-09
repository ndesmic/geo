import { test, expect } from "@playwright/test";

test("Should transform group camera", async ({ page }) => {
    await page.goto("http://localhost:4507/visual-tests/should-transform-group-camera/should-transform-group-camera.html");
    await expect(page).toHaveTitle("Geo - Should transform group camera");
    const canvas = await page.locator("canvas");
    await expect(canvas).toHaveScreenshot();
});