import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'warning' || msg.type() === 'error') {
      console.log(`${msg.type()}: ${msg.location().url}:${msg.location().lineNumber} -> ${msg.text()}`);
    }
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  
  // click a bit to maybe trigger warnings
  try {
    const buttons = await page.$$('button');
    if (buttons.length > 0) {
      for(let i = 0; i < Math.min(5, buttons.length); i++) {
        await buttons[i].click();
        await new Promise(r => setTimeout(r, 500));
      }
    }
  } catch (e) {}

  await browser.close();
})();
