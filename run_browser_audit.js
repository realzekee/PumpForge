import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();

  // Monitor network
  const requests = [];
  page.on('request', req => {
    requests.push({ method: req.method(), url: req.url() });
  });

  page.on('response', async res => {
    if (res.status() >= 400) {
      console.log(`[HTTP ${res.status()}] ${res.request().method()} ${res.url()}`);
      try {
        const text = await res.text();
        console.log(`  Response body snippet: ${text.slice(0, 200)}`);
      } catch (e) {}
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[Browser Console ${msg.type()}]: ${msg.text()}`);
    }
  });

  const viewports = [
    { name: 'Desktop (1280x800)', width: 1280, height: 800 },
    { name: 'Tablet (768x1024)', width: 768, height: 1024 },
    { name: 'Mobile (390x844)', width: 390, height: 844 }
  ];

  for (const vp of viewports) {
    console.log(`\n=== Testing Viewport: ${vp.name} ===`);
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1000));

    // Check overflow
    const overflowInfo = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const winWidth = window.innerWidth;
      const bodyWidth = document.body.scrollWidth;

      const overflowingElements = [];
      document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.right > winWidth + 1) {
          overflowingElements.push({
            tag: el.tagName,
            id: el.id,
            className: (el.className || '').toString().slice(0, 80),
            right: rect.right,
            width: rect.width,
            windowWidth: winWidth
          });
        }
      });

      return {
        hasOverflow: docWidth > winWidth || bodyWidth > winWidth,
        docWidth,
        winWidth,
        bodyWidth,
        overflowingCount: overflowingElements.length,
        topOverflowing: overflowingElements.slice(0, 10)
      };
    });

    console.log(`Overflow check for ${vp.name}:`, JSON.stringify(overflowInfo, null, 2));

    // Now navigate to Market page
    console.log(`Navigating to /market on ${vp.name}...`);
    await page.goto('http://localhost:3000/market', { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1000));

    const marketOverflow = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const winWidth = window.innerWidth;
      const overflowingElements = [];
      document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.right > winWidth + 1) {
          overflowingElements.push({
            tag: el.tagName,
            id: el.id,
            className: (el.className || '').toString().slice(0, 80),
            right: rect.right,
            width: rect.width
          });
        }
      });
      return {
        hasOverflow: docWidth > winWidth,
        docWidth,
        winWidth,
        topOverflowing: overflowingElements.slice(0, 5)
      };
    });
    console.log(`Market page overflow check for ${vp.name}:`, JSON.stringify(marketOverflow, null, 2));

    // Try clicking coin
    const clickResult = await page.evaluate(() => {
      // Find coins in table or list
      const rows = document.querySelectorAll('tr, .p-3\\.5');
      const buttons = document.querySelectorAll('button');
      return {
        rowCount: rows.length,
        buttonCount: buttons.length,
        location: window.location.pathname
      };
    });
    console.log(`Market elements on ${vp.name}:`, clickResult);
  }

  await browser.close();
  console.log('Audit complete.');
})();
