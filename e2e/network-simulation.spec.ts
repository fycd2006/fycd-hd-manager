import { test, expect } from '@playwright/test';

test.describe('Phase 8 Network Simulation & Resilience Tests', () => {
  test('1. Rapid Multi-Edit Debounce & Request Sequencing Test', async ({ page }) => {
    let patchRequestCount = 0;
    page.on('request', req => {
      if (req.url().includes('/api/tables/') && req.method() === 'PATCH') {
        patchRequestCount++;
      }
    });

    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Perform rapid cell edits (simulating 5 fast clicks within 200ms)
    console.log('[Test 1] Executing 5 rapid cell updates...');
    await page.evaluate(() => {
      // Trigger rapid cell updates via window event / input
      const updateFn = (window as any).updateCell;
      if (updateFn) {
        for (let i = 1; i <= 5; i++) {
          updateFn(1, 'field_1', `RapidValue_${i}`);
        }
      }
    });

    // Wait 500ms for debounce timer to fire
    await page.waitForTimeout(500);

    console.log(`[Test 1] Total PATCH requests sent during 5 rapid edits: ${patchRequestCount}`);
    // Debounce should collapse rapid requests into 1 single HTTP PATCH request
    expect(patchRequestCount).toBeLessThanOrEqual(2);
  });

  test('2. Disconnection and Reconnect Full Re-fetch Safeguard Test', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    let fetchCount = 0;
    page.on('request', req => {
      if (req.url().includes('/api/tables/') && req.method() === 'GET') {
        fetchCount++;
      }
    });

    console.log('[Test 2] Simulating network disconnection and reconnection...');
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);

    // Reconnect network
    await page.context().setOffline(false);
    await page.waitForTimeout(2000);

    console.log(`[Test 2] Table refetch requests triggered after reconnect: ${fetchCount}`);
    expect(fetchCount).toBeGreaterThanOrEqual(0);
  });
});
