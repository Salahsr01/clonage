const { chromium } = require('playwright');

(async () => {
  const blocked = [];
  const allowed = [];

  // Patterns to block (framework/hydration scripts)
  const BLOCK_PATTERNS = [
    /framework/i,
    /_app/i,
    /main-app/i,
    /webpack/i,
    /react/i,
    /next\/dist/i,
    /hydrat/i,
  ];

  // Patterns to always allow (animation/utility scripts)
  const ALLOW_PATTERNS = [
    /gsap/i,
    /lenis/i,
    /scrolltrigger/i,
    /splittext/i,
    /three/i,
    /unicornstudio/i,
    /spline/i,
  ];

  function classifyRequest(url) {
    // Check allow-list first — animation libs take priority
    for (const pat of ALLOW_PATTERNS) {
      if (pat.test(url)) return 'allow';
    }
    // Check block-list
    for (const pat of BLOCK_PATTERNS) {
      if (pat.test(url)) return 'block';
    }
    // Default: allow (non-framework scripts often fail gracefully)
    return 'allow';
  }

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // ---- Set up route interception BEFORE navigation ----
  await page.route('**/*.js', (route) => {
    const url = route.request().url();
    const verdict = classifyRequest(url);
    if (verdict === 'block') {
      blocked.push(url);
      route.abort();
    } else {
      allowed.push(url);
      route.continue();
    }
  });

  // Also intercept inline script fetches that come as other resource types
  await page.route('**/_next/static/chunks/**', (route) => {
    const url = route.request().url();
    // Re-check: some chunk URLs don't end in .js but are still JS
    if (route.request().resourceType() === 'script') {
      const verdict = classifyRequest(url);
      if (verdict === 'block') {
        blocked.push(url);
        return route.abort();
      }
    }
    allowed.push(url);
    route.continue();
  });

  console.log('Navigating to https://elevenlabs.io/ ...');
  try {
    await page.goto('https://elevenlabs.io/', {
      waitUntil: 'load',
      timeout: 30000,
    });
  } catch (err) {
    console.warn('Navigation warning (may be expected with blocked scripts):', err.message);
  }

  console.log('Waiting 3 seconds for animations to settle...');
  await page.waitForTimeout(3000);

  // ---- Screenshot ----
  const screenshotPath = '/Volumes/T7/oue/test-proxy-stub-result.png';
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Screenshot saved to ${screenshotPath}`);

  // ---- Report blocked vs allowed ----
  console.log('\n========== BLOCKED SCRIPTS ==========');
  console.log(`Count: ${blocked.length}`);
  blocked.forEach((u) => console.log('  [BLOCKED] ' + u));

  console.log('\n========== ALLOWED SCRIPTS ==========');
  console.log(`Count: ${allowed.length}`);
  allowed.forEach((u) => console.log('  [ALLOWED] ' + u));

  // ---- Check hero content ----
  console.log('\n========== HERO CONTENT CHECK ==========');
  const h1 = await page.$('h1');
  if (h1) {
    const text = await h1.textContent();
    console.log(`h1 found — text: "${text.trim()}"`);
    if (/bringing.*technology.*to.*life/i.test(text.trim())) {
      console.log('PASS: Hero text matches expected content.');
    } else {
      console.log('INFO: Hero text differs from expected "Bringing technology to life".');
    }
  } else {
    console.log('WARN: No <h1> element found on page.');
  }

  // ---- Check for running animations ----
  console.log('\n========== ANIMATION CHECK ==========');
  const animatedElements = await page.evaluate(() => {
    const results = [];
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const style = window.getComputedStyle(el);
      const transform = style.transform;
      const opacity = style.opacity;
      const transition = style.transition;
      const animation = style.animation;

      const hasTransform = transform && transform !== 'none';
      const hasPartialOpacity = opacity && parseFloat(opacity) > 0 && parseFloat(opacity) < 1;
      const hasTransition = transition && transition !== 'all 0s ease 0s' && transition !== 'none';
      const hasAnimation = animation && animation !== 'none';

      if (hasTransform || hasPartialOpacity || hasTransition || hasAnimation) {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const cls = el.className && typeof el.className === 'string'
          ? '.' + el.className.split(' ').slice(0, 2).join('.')
          : '';
        results.push({
          selector: `${tag}${id}${cls}`,
          transform: hasTransform ? transform : null,
          opacity: hasPartialOpacity ? opacity : null,
          transition: hasTransition ? transition : null,
          animation: hasAnimation ? animation : null,
        });
      }
    }
    return results.slice(0, 30); // Limit output
  });

  if (animatedElements.length > 0) {
    console.log(`Found ${animatedElements.length} elements with transform/opacity/transition/animation styles:`);
    animatedElements.forEach((el) => {
      const parts = [];
      if (el.transform) parts.push(`transform=${el.transform}`);
      if (el.opacity) parts.push(`opacity=${el.opacity}`);
      if (el.transition) parts.push(`transition=${el.transition.substring(0, 60)}`);
      if (el.animation) parts.push(`animation=${el.animation.substring(0, 60)}`);
      console.log(`  ${el.selector} → ${parts.join(', ')}`);
    });
  } else {
    console.log('No elements with active transform/opacity/transition/animation found.');
  }

  // ---- Summary ----
  console.log('\n========== SUMMARY ==========');
  console.log(`Scripts blocked: ${blocked.length}`);
  console.log(`Scripts allowed: ${allowed.length}`);
  console.log(`Hero h1 present: ${h1 ? 'YES' : 'NO'}`);
  console.log(`Animated elements: ${animatedElements.length}`);
  console.log('Done.');

  await browser.close();
})();
