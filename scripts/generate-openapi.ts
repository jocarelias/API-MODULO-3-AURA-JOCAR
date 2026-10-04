import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { dump } from 'js-yaml';
import { buildOpenApi } from '../src/openapi';

const HEADER = [
  '# ============================================================================',
  '#  Ficheiro GERADO AUTOMATICAMENTE — NAO EDITAR A MAO',
  '#',
  '#  Fonte de verdade: src/openapi.ts (buildOpenApi())',
  '#  Regenerar com:   npm run docs:openapi',
  '#',
  '#  Qualquer alteracao feita a mao e perdida no proximo `npm run docs:openapi`,',
  '#  e o teste src/openapi.test.ts falha se este ficheiro divergir do codigo.',
  '# ============================================================================',
  '',
].join('\n');

const target = resolve(process.cwd(), 'docs/openapi.yaml');
mkdirSync(dirname(target), { recursive: true });

const yaml = dump(buildOpenApi(), {
  indent: 2,
  lineWidth: 120,
  noRefs: true,
  sortKeys: false,
  quotingType: '"',
  forceQuotes: false,
});

writeFileSync(target, HEADER + yaml, 'utf8');
process.stdout.write(`OpenAPI gerado em ${target}\n`);
