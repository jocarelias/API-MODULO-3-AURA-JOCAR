/**
 * Gera as capturas de ecrã do Swagger UI exigidas pelo guião (Módulo VI, Passo 2).
 *
 * Usa o Brave já instalado no sistema (contentor Linglong) como navegador,
 * por isso não é preciso descarregar nenhum Chromium adicional.
 *
 * Cenários documentados, um por captura:
 *   01-docs-raiz         especificação carregada, endpoint sob a tag Notas
 *   02-login             POST /auth/login com credenciais de seed -> token
 *   03-authorize         token configurado no botão Authorize
 *   04-200-sucesso       TEACHER -> 200 com as notas da turma
 *   05-200-escopo        STUDENT -> 200 apenas com a nota dele (anti-BOLA)
 *   06-401-sem-token     sem Authorize -> 401 UNAUTHENTICATED
 *   07-403-sem-permissao STUDENT noutra turma -> 403 FORBIDDEN
 *   08-404-inexistente   assessmentId inexistente -> 404 NOT_FOUND
 *   09-400-invalido      assessmentId mal formado -> 400 VALIDATION_ERROR
 */

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const BRAVE =
  '/var/lib/linglong/layers/aec6d8545830070e8ec8c4df4ea82b5d40f95737b95b55d6643a8cdc630a4c86/files/com.brave.brave-browser/brave';
const BASE = process.env.SWAGGER_BASE || 'http://localhost:4100';
const OUT = process.env.SHOTS_DIR || '/tmp/opencode/shots';
const GRADE_OP = 'Notas-getAssessmentsAssessmentIdGrades';
const LOGIN_PATH = '/api/v1/auth/login';
const LOGIN_OP = 'Autenticação-postAuthLogin';

// Avaliação da turma do aluno1 -> o STUDENT tem posse e vê 1 nota.
const ALUNO_ASSESSMENT = 'a4a6c3b2-65cc-4d29-a11d-361eeb5be091';
// Avaliação de outra turma -> anti-BOLA: o STUDENT recebe 403.
const OUTRA_TURMA = '587aa5cc-59fb-487b-af89-44f380e5ee8b';

const SEED = {
  teacher: { email: 'prof1@ucjac.ac.mz', password: 'prof123', role: 'TEACHER' },
  student: { email: 'aluno1@student.ucjac.ac.mz', password: 'aluno123', role: 'STUDENT' },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  captura ${name}.png`);
  return file;
}

/** Faz login pela API (rápido e fiável) e devolve o access token. */
async function login(apiRequest, creds) {
  const res = await apiRequest.post(`${BASE}${LOGIN_PATH}`, {
    data: { email: creds.email, password: creds.password },
  });
  if (res.status() !== 200) {
    throw new Error(`login ${creds.role} falhou: HTTP ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return body.data.accessToken;
}

/** Expande a operação indicada dentro do Swagger UI. */
async function expandOperation(page, method, operationId) {
  const block = page.locator(`#operations-${operationId}`);
  await block.waitFor({ state: 'visible', timeout: 30000 });
  if (!(await block.getAttribute('class')).includes('is-open')) {
    await block.locator('.opblock-summary').click();
  }
  await sleep(700);
  return block;
}

/** Executa a operação e devolve { status, body }. */
async function tryIt(page, block, { pathParams = {}, queryParams = {}, body } = {}) {
  let seenAuth = null;
  const spy = (req) => {
    if (req.url().includes('/grades')) seenAuth = req.headers().authorization || null;
  };
  page.on('request', spy);
  await block.getByRole('button', { name: /try it out/i }).click();
  await sleep(400);

  for (const [name, value] of Object.entries(pathParams)) {
    const input = block.locator(`input[placeholder="${name}"]`).first();
    await input.fill(String(value), { force: true });
  }
  for (const [name, value] of Object.entries(queryParams)) {
    const input = block.locator(`input[placeholder="${name}"]`).first();
    if (await input.count()) await input.fill(String(value), { force: true });
  }

  if (body !== undefined) {
    const ta = block.locator('textarea.body-param__text').first();
    await ta.fill(JSON.stringify(body, null, 2));
  }

  await block.getByRole('button', { name: /execute/i }).click();
  await sleep(1500);

  const status = (
    await block
      .locator('.live-responses-table .response .response-col_status')
      .first()
      .innerText()
  ).trim();
  const payload = await block
    .locator('.responses-table.live-responses-table .response .response-col_description')
    .first()
    .innerText()
    .catch(() => '');

  page.off('request', spy);
  return { status, payload, auth: seenAuth };
}

/** Limpa o token guardado no localStorage do Swagger UI. */
async function clearAuth(page) {
  await page.evaluate(() => window.localStorage.removeItem('authorized'));
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(1200);
}

/** Configura o token no diálogo Authorize (http bearer). */
async function authorize(page, token) {
  const input = page.locator('.dialog-ux input[type="text"]').first();
  await page.getByRole('button', { name: /^authorize$/i }).first().click({ force: true });
  // o dialogo pode ja estar aberto de uma interacao anterior
  for (let i = 0; i < 20 && (await input.count()) === 0; i += 1) {
    await sleep(300);
    if (i === 8) await page.getByRole('button', { name: /^authorize$/i }).first().click();
  }
  await input.waitFor({ state: 'attached', timeout: 15000 });
  await input.click({ force: true });
  await input.fill('');
  await input.pressSequentially(token, { delay: 3 });
  await sleep(400);
  await page.locator('.dialog-ux button.authorize').first().click({ force: true });
  await sleep(1400);
  // Swagger UI guarda o token em memoria (persistAuthorization=false), por isso
  // confirmamos pelo cadeado do toolbar e pelo header do proximo pedido.
  const cls = await page.evaluate(
    () => document.querySelector('button.authorize')?.className || '',
  );
  const locked = cls.includes('locked') ? 1 : 0;
  console.log(`  Authorize -> ${locked ? 'token activo (cadeado visivel)' : 'FALHOU: sem token'}`);
  await page.locator('.dialog-ux button.btn-done').first().click({ force: true }).catch(() => {});
  await sleep(900);
  return locked > 0;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    executablePath: BRAVE,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 2200 },
    deviceScaleFactor: 1,
    locale: 'pt-PT',
  });
  const page = await context.newPage();
  const api = await context.request;

  console.log('obtendo tokens de seed pela API...');
  const teacherToken = await login(api, SEED.teacher);
  const studentToken = await login(api, SEED.student);
  console.log(`  TEACHER ${teacherToken.slice(0, 24)}...`);
  console.log(`  STUDENT ${studentToken.slice(0, 24)}...`);

  // 01 — raiz da documentacao
  console.log('\n[01] raiz da documentacao');
  await page.goto(`${BASE}/api/docs`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.opblock', { timeout: 30000 });
  await sleep(1500);
  await page.locator(`#operations-${GRADE_OP}`).scrollIntoViewIfNeeded();
  await sleep(600);
  await shot(page, '01-docs-raiz');

  // 02 — login via Swagger UI (Try it out no endpoint de login)
  console.log('[02] POST /auth/login pelo Swagger UI');
  const loginBlock = await expandOperation(page, 'post', LOGIN_OP);
  await loginBlock.getByRole('button', { name: /try it out/i }).click();
  await sleep(500);
  await shot(page, '02-login-preenchido');
  await loginBlock.getByRole('button', { name: /cancel/i }).click();
  await sleep(500);
  await expandOperation(page, 'post', LOGIN_OP);
  const loginRes = await tryIt(page, loginBlock, {
    body: { email: SEED.teacher.email, password: SEED.teacher.password },
  });
  console.log(`  login -> ${loginRes.status}`);
  await shot(page, '02b-login-resposta');

  // 03 — Authorize com o token do TEACHER
  console.log('[03] Authorize');
  await authorize(page, teacherToken);
  await shot(page, '03-authorize');

  // 04 — 200 TEACHER
  console.log('[04] GET .../grades com TEACHER');
  let block = await expandOperation(page, 'get', GRADE_OP);
  let r = await tryIt(page, block, { pathParams: { assessmentId: ALUNO_ASSESSMENT } });
  console.log(`  -> ${r.status}  Authorization: ${r.auth ? r.auth.slice(0, 20) + '...' : 'AUSENTE'}`);
  await shot(page, '04-200-teacher');

  // 05 — 200 STUDENT (escopo reduzido): recarrega para limpar o token do TEACHER
  console.log('[05] GET .../grades com STUDENT');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.opblock', { timeout: 30000 });
  await authorize(page, studentToken);
  block = await expandOperation(page, 'get', GRADE_OP);
  r = await tryIt(page, block, { pathParams: { assessmentId: ALUNO_ASSESSMENT } });
  console.log(`  -> ${r.status}  Authorization: ${r.auth ? r.auth.slice(0, 20) + '...' : 'AUSENTE'}`);
  await shot(page, '05-200-student-escopo');

  // 06 — 401 sem token
  console.log('[06] sem token');
  await clearAuth(page);
  block = await expandOperation(page, 'get', GRADE_OP);
  r = await tryIt(page, block, { pathParams: { assessmentId: ALUNO_ASSESSMENT } });
  console.log(`  -> ${r.status}  Authorization: ${r.auth ? r.auth.slice(0, 20) + '...' : 'AUSENTE'}`);
  await shot(page, '06-401-sem-token');

  // 07 — 403 STUDENT noutra turma (anti-BOLA por posse)
  console.log('[07] STUDENT noutra turma');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.opblock', { timeout: 30000 });
  await authorize(page, studentToken);
  block = await expandOperation(page, 'get', GRADE_OP);
  r = await tryIt(page, block, { pathParams: { assessmentId: OUTRA_TURMA } });
  console.log(`  -> ${r.status}  Authorization: ${r.auth ? r.auth.slice(0, 20) + '...' : 'AUSENTE'}`);
  await shot(page, '07-403-anti-bola');

  // 08 — 404 inexistente
  console.log('[08] assessmentId inexistente');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.opblock', { timeout: 30000 });
  await authorize(page, teacherToken);
  block = await expandOperation(page, 'get', GRADE_OP);
  r = await tryIt(page, block, { pathParams: { assessmentId: '00000000-0000-0000-0000-000000000001' } });
  console.log(`  -> ${r.status}  Authorization: ${r.auth ? r.auth.slice(0, 20) + '...' : 'AUSENTE'}`);
  await shot(page, '08-404-inexistente');

  // 09 — validacao do parametro no proprio Swagger UI
  // O parametro esta declarado como format: uuid, por isso o Swagger UI bloqueia
  // 'abc' no cliente e NAO envia o pedido. A API devolve 400 VALIDATION_ERROR para
  // clientes que nao pre-validam (curl, Postman, testes) — ver a evidencia txt.
  console.log('[09] assessmentId mal formado (validacao no cliente)');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.opblock', { timeout: 30000 });
  await authorize(page, teacherToken);
  block = await expandOperation(page, 'get', GRADE_OP);
  await block.getByRole('button', { name: /try it out/i }).click();
  await sleep(500);
  await block.locator('input[placeholder="assessmentId"]').first().fill('abc', { force: true });
  await block.getByRole('button', { name: /execute/i }).click();
  await sleep(2000);
  const warn = await block
    .locator('.validation-messages, .opblock-section-request-body .error, .invalid-parameter')
    .first()
    .innerText()
    .catch(() => '');
  const texto = await block.innerText();
  const avisos = texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /validation errors|Value must be|Guid|correct/i.test(l));
  console.log(`  aviso no cliente: ${avisos.join(' | ') || warn || '(nenhum)'}`);
  await shot(page, '09-400-validacao-cliente');

  await browser.close();
  console.log(`\ncapturas em ${OUT}`);
}

main().catch((err) => {
  console.error('FALHOU:', err.message);
  process.exit(1);
});