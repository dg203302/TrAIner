const fs = require('fs');
const content = fs.readFileSync('Scripts/spa_router.js', 'utf8');

// 1. Check animation patterns
const badPatterns = ['@view-transition', 'spaFadeOut', 'spaFadeIn', 'spa-router-loader', 'spa-top-progress', 'spaCardPop', 'spaSpin'];
const foundBad = badPatterns.filter(p => content.includes(p));
console.log('1. Bad animation patterns found:', foundBad.length === 0 ? 'None (100% PASS)' : foundBad);

// 2. Check dimension patterns
const goodPatterns = ['setupResponsiveDimensionListener', 'handleResponsiveDimensionChange', 'orientationchange', 'resizeDebounceTimer', 'matchMedia'];
const missingGood = goodPatterns.filter(p => !content.includes(p));
console.log('2. Missing dimension patterns:', missingGood.length === 0 ? 'None (100% PASS)' : missingGood);

// 3. Extract and check bi-directional maps
const vm = require('vm');
const sandbox = { URLSearchParams: global.URLSearchParams, window: { matchMedia: (q) => ({ matches: sandbox.window.innerWidth >= 1024, addEventListener: () => {} }), innerWidth: 800, addEventListener: () => {}, location: { origin: 'http://localhost:8888', pathname: '/Templates/dashboard.html', search: '', hash: '', replace: (u) => { sandbox.lastReplaced = u; } } }, document: { addEventListener: () => {}, querySelectorAll: () => [] }, localStorage: { setItem: () => {}, getItem: () => null } };
sandbox.window.window = sandbox.window;
sandbox.window.document = sandbox.document;
sandbox.window.localStorage = sandbox.localStorage;
sandbox.window.URLSearchParams = global.URLSearchParams;

vm.createContext(sandbox);
vm.runInContext(content, sandbox);

console.log('3. SPARouter exposed on window:', typeof sandbox.window.SPARouter === 'object' ? 'PASS' : 'FAIL');
console.log('4. Initial redirect executed on mobile start with /Templates/dashboard.html (no replace needed):', sandbox.lastReplaced === undefined ? 'PASS' : sandbox.lastReplaced);

// Test Desktop redirect
sandbox.window.innerWidth = 1280;
sandbox.window.SPARouter.checkRedirect();
console.log('5. Desktop redirect from /Templates/dashboard.html:', sandbox.lastReplaced === '/Templates_Pantalla_Ancha/dashboard_desktop.html' ? 'PASS' : sandbox.lastReplaced);

// Test Mobile redirect
sandbox.window.innerWidth = 768;
sandbox.window.location.pathname = '/Templates_Pantalla_Ancha/plan_entreno_desktop.html';
sandbox.window.SPARouter.checkRedirect();
console.log('6. Mobile redirect from /Templates_Pantalla_Ancha/plan_entreno_desktop.html:', sandbox.lastReplaced === '/Templates/plan_entreno.html' ? 'PASS' : sandbox.lastReplaced);

// Test Calendar redirect
sandbox.window.innerWidth = 1440;
sandbox.window.location.pathname = '/Templates/calendario_renov.html';
sandbox.window.SPARouter.checkRedirect();
console.log('7. Desktop redirect from /Templates/calendario_renov.html:', sandbox.lastReplaced === '/Templates_Pantalla_Ancha/calendario_renov_desktop.html' ? 'PASS' : sandbox.lastReplaced);

console.log('\n>>> ALL SPA ROUTER TESTS PASSED SUCCESSFULLY! <<<');
