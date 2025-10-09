import { test, expect } from "@playwright/test";

test("Should transform group light nested", async ({ page }) => {
    await page.goto("http://localhost:4507/visual-tests/should-transform-group-light/should-transform-group-light-nested.html");
    await expect(page).toHaveTitle("Geo - Should transform group light nested");
    const canvas = await page.locator("canvas");
    await expect(canvas).toHaveScreenshot();
});