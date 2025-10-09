import { defineConfig } from '@playwright/test';

export default defineConfig({
    use: {
        channel: "chrome",
        launchOptions: {
            // force GPU hardware acceleration
            // (even in headless mode)
            args: [
                '--enable-gpu'
            ]
        }
    },
    testMatch: '**/*.spec.js',
    // Run your local dev server before starting the tests
    webServer: {
        command: process.platform === 'win32'
            ? `powershell -ExecutionPolicy ByPass -File "start.ps1"`
            : `sh -c "./start.sh"`,
        url: 'http://localhost:4507',
        reuseExistingServer: !process.env.CI,
    },
});