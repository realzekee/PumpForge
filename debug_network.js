import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();

  page.on('request', req => {
    console.log(`[REQ] ${req.method()} ${req.url()}`);
  });

  page.on('response', async res => {
    console.log(`[RES] ${res.status()} ${res.request().method()} ${res.url()}`);
    if (res.status() >= 400) {
      try {
        const body = await res.text();
        console.log(`  ERROR BODY: ${body.slice(0, 300)}`);
      } catch (e) {}
    }
  });

  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type()}]: ${msg.text()}`);
  });

  await page.setViewport({ width: 1280, height: 800 });
  console.log("=== Loading http://localhost:3000 ===");
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  console.log("=== Navigating to http://localhost:3000/market ===");
  await page.goto('http://localhost:3000/market', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  await browser.close();
})();
