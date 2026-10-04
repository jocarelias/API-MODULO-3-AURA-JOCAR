import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { renderAccessTableMarkdown } from '../src/modules/schedules-assessments/infrastructure/auth/routeAccess';

const target = resolve(process.cwd(), 'docs/ROUTE_ACCESS.md');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, renderAccessTableMarkdown(), 'utf8');
process.stdout.write(`Tabela Rota -> Roles gerada em ${target}\n`);
