import { createRequire } from 'node:module';
const require = createRequire('D:/Project/Fun/juicy-calendar/juicy-calendar/package.json');
const { chromium } = require('@playwright/test');
const b = await chromium.connectOverCDP('http://127.0.0.1:9333'); const page = b.contexts()[0].pages()[0];
const bar = page.getByTestId('selection-bar');
console.log('bar text:', JSON.stringify(await bar.innerText()), '| button aria:', await page.getByTestId('selection-delete').getAttribute('aria-label'));
console.log('bar box', JSON.stringify(await bar.boundingBox()), '| btn box', JSON.stringify(await page.getByTestId('selection-delete').boundingBox()));
await page.screenshot({ path: process.argv[2] });
await b.close().catch(()=>{});
