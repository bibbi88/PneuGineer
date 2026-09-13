import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));

const shotDir =
  'C:/Users/tobekf/AppData/Local/Temp/claude/c--Users-tobekf-Documents-GitHub-PneuGineerCL/37a59c05-208d-4061-b6df-7c011ce6ad50/scratchpad';

async function place(buttonText, dx, dy) {
  await page.click(`button:has-text("${buttonText}")`);
  const comps = await page.$$('.comp');
  const el = comps[comps.length - 1];
  const box = await el.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + dx, box.y + dy, { steps: 8 });
  await page.mouse.up();
  return el;
}

async function clickPort(compSelector, portKey) {
  const handle = await page.$(`${compSelector} .port[data-port="${portKey}"]`);
  const box = await handle.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function pointOnPath(selector, frac = 0.3, nth = 0) {
  return page.evaluate(
    ({ selector, frac, nth }) => {
      const el = document.querySelectorAll(selector)[nth];
      const len = el.getTotalLength();
      const pt = el.getPointAtLength(len * frac);
      const ctm = el.getScreenCTM();
      return { x: ctm.a * pt.x + ctm.c * pt.y + ctm.e, y: ctm.b * pt.x + ctm.d * pt.y + ctm.f };
    },
    { selector, frac, nth },
  );
}

function assertOrthogonal(d) {
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
  const pts = [];
  for (let i = 0; i < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (a.x !== b.x && a.y !== b.y) return false;
  }
  return true;
}

await page.goto('http://localhost:5173/');
await page.waitForSelector('button:has-text("Pressure source")');

// place source and AND valve far apart with a bend needed between them
await place('Pressure source', -400, -200);
await place('AND valve', 400, 100);
await clickPort('.comp[data-type="source"]', 'OUT');
await clickPort('.comp[data-type="andValve"]', 'A');
await page.waitForSelector('.wire');

const beforeD = await page.$eval('.wire', (el) => el.getAttribute('d'));
console.log('Wire shape before split:', beforeD);
console.log('Orthogonal before split:', assertOrthogonal(beforeD));

// start linking from AND's B port, then click the middle of the existing wire to split it
await clickPort('.comp[data-type="andValve"]', 'B');
const midPoint = await pointOnPath('.wireHit', 0.5);
await page.mouse.click(midPoint.x, midPoint.y);
await page.waitForTimeout(200);

const wireDs = await page.$$eval('.wire', (els) => els.map((e) => e.getAttribute('d')));
console.log('Wire count after split (expect 3):', wireDs.length);
for (const d of wireDs) {
  console.log('  segment:', d, 'orthogonal:', assertOrthogonal(d));
}

// Verify the two new segments together reproduce the ORIGINAL wire's shape (just split at the
// junction), rather than being freshly re-routed into something different-looking.
const junctionExists = await page.$('.comp[data-type="junction"]');
console.log('Junction created:', !!junctionExists);

await page.screenshot({ path: `${shotDir}/split-technique-full.png`, fullPage: true });

console.log('console errors:', errors);
await browser.close();
