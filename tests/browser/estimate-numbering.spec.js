import {test,expect} from './fixtures.js';
test('local demonstration reserves six digit numbers once and advances for another quote',async({page})=>{
 await page.goto('/admin.html');
 await page.locator('#local-preview').click();
 await page.locator('[data-tab="estimates"]').click();
 await page.locator('#new-laser-estimate').click();
 await page.locator('#estimate-form [name="customer"]').fill('Sequência');
 await expect(page.locator('#estimate-form [name="number"]')).toHaveValue(/^RASCUNHO-/);
 await page.locator('#estimate-save').click();
 await expect(page.locator('#estimate-form [name="number"]')).toHaveValue(/^PM-\d{8}-000001$/);
 await page.locator('#estimate-save').click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('papeled-issued-estimates-v1')||'[]').length)).toBe(1);
 await page.locator('#estimate-new').click();
 await expect(page.locator('#estimate-leave-dialog')).toBeHidden();
 await page.locator('#estimate-form [name="customer"]').fill('Outro cliente');
 await page.locator('#estimate-save').click();
 await expect(page.locator('#estimate-form [name="number"]')).toHaveValue(/^PM-\d{8}-000002$/);
});
