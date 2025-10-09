import { test, expect } from "@playwright/test";

test("Environment should be setup correctly", async ({ page }) => {
    page.goto("chrome://gpu");
    await expect(page).toHaveTitle("GPU Internals");
    await page.evaluate(async () => {
        document.querySelector("info-view").shadowRoot.querySelector(".info-table:first-child tr:first-of-type").style.display = "none";
    });
    await expect(page.getByText('WebGPU: Hardware accelerated')).toBeVisible();
    await expect(page).toHaveScreenshot({ maxDiffPixelRatio: 0.05 });
});