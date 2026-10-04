import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROUTE_ACCESS, PUBLIC_ROUTES, accessRule, routeKey, isSuperAdmin, renderAccessTableMarkdown, type HttpMethod } from './routeAccess';
import { POSSESSION_KINDS, assertPossessionGuardExists, isStudentScoped, isTeacherScoped } from './accessPolicy';
import { ROLES } from '@smartcampus/shared-types';

describe('Tabela de acessos ROUTE_ACCESS', () => {
  it('não tem entradas duplicadas (mesmo método + path)', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const rule of ROUTE_ACCESS) {
      const key = routeKey(rule.method, rule.path);
      if (seen.has(key)) {
        duplicates.push(key);
      }
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });

  it('todas as entradas têm roles válidos, summary e posse declarada', () => {
    for (const rule of ROUTE_ACCESS) {
      expect(rule.roles.length, `${routeKey(rule.method, rule.path)} sem roles`).toBeGreaterThan(0);
      expect(rule.summary.trim().length, `${routeKey(rule.method, rule.path)} sem summary`).toBeGreaterThan(0);
      expect(rule.possession, `${routeKey(rule.method, rule.path)} sem posse`).toBeTruthy();
      for (const role of rule.roles) {
        expect(ROLES).toContain(role);
      }
    }
  });

  it('toda regra de posse tem um guard implementado', () => {
    for (const rule of ROUTE_ACCESS) {
      expect(() => assertPossessionGuardExists(rule), routeKey(rule.method, rule.path)).not.toThrow();
    }
  });

  it('toda posse declarada existe em POSSESSION_KINDS', () => {
    for (const rule of ROUTE_ACCESS) {
      expect(POSSESSION_KINDS, `${routeKey(rule.method, rule.path)} → ${rule.possession}`).toContain(rule.possession);
    }
  });

  it('as rotas públicas não exigem token', () => {
    for (const route of PUBLIC_ROUTES) {
      const [method, path] = route.split(' ');
      const rule = ROUTE_ACCESS.find((r) => r.method === method && r.path === path);
      expect(rule, `${route} não deve constar de ROUTE_ACCESS`).toBeUndefined();
    }
  });

  it('acessoRule devolve a regra exacta e falha em rotas desconhecidas', () => {
    const rule = accessRule('GET', '/results');
    expect(rule.roles).toContain('STUDENT');
    expect(() => accessRule('GET', '/rota-que-nao-existe' as never)).toThrow(/sem regra de acesso/i);
  });

  it('rotas de escrita de recursos exigem posse explícita (nunca "none")', () => {
    const writes = ROUTE_ACCESS.filter((r) => r.method === 'POST' || r.method === 'PATCH' || r.method === 'PUT' || r.method === 'DELETE');
    expect(writes.length).toBeGreaterThan(0);
    for (const rule of writes) {
      if (rule.path === '/auth/logout') {
        continue;
      }
      const isCatalogCreate = rule.path === '/assessments' || rule.path === '/schedules' || rule.path === '/results' || rule.path === '/results/calculate';
      if (isCatalogCreate) {
        continue;
      }
      expect(rule.possession, `${routeKey(rule.method, rule.path)} deve declarar posse`).not.toBe('none');
      expect(isTeacherScoped(rule.possession), `${routeKey(rule.method, rule.path)} deve ter posse de docente`).toBe(true);
    }
  });

  it('rotas que devolvem notas/resultados de um estudante têm posse de estudante', () => {
    const sensitive = ROUTE_ACCESS.filter(
      (r) =>
        (r.path === '/results' || r.path === '/results/:id' || r.path === '/me/financial-status' || r.path.includes('grades')) &&
        r.roles.includes('STUDENT'),
    );
    expect(sensitive.length).toBeGreaterThan(0);
    for (const rule of sensitive) {
      expect(isStudentScoped(rule.possession), `${routeKey(rule.method, rule.path)} → ${rule.possession}`).toBe(true);
    }
  });

  it('isSuperAdmin só reconhece o role SUPER_ADMIN', () => {
    expect(isSuperAdmin('SUPER_ADMIN')).toBe(true);
    expect(isSuperAdmin('SCHOOL_ADMIN')).toBe(false);
    expect(isSuperAdmin('TEACHER')).toBe(false);
    expect(isSuperAdmin('')).toBe(false);
  });

  it('o método é parte da chave: GET e PATCH na mesma path são regras distintas', () => {
    const methods: HttpMethod[] = ['GET', 'POST', 'PATCH', 'DELETE'];
    const get = accessRule('GET', '/results/:id');
    const patch = accessRule('PATCH', '/results/:id');
    const del = accessRule('DELETE', '/results/:id');
    expect(methods).toContain(get.method);
    expect(get.possession).not.toBe(patch.possession);
    expect(patch.possession).toBe(del.possession);
  });

  it('a tabela Rota -> Roles gerada em docs está sincronizada com o código', () => {
    const file = resolve(process.cwd(), 'docs/ROUTE_ACCESS.md');
    const onDisk = readFileSync(file, 'utf8');
    // Se esta comparação falhar, correr `npm run docs:access-table`.
    expect(onDisk).toBe(renderAccessTableMarkdown());
  });

  it('a tabela gerada menciona todas as rotas protegidas', () => {
    const markdown = renderAccessTableMarkdown();
    for (const rule of ROUTE_ACCESS) {
      expect(markdown).toContain(`\`${rule.path}\``);
    }
    for (const route of PUBLIC_ROUTES) {
      expect(markdown).toContain(`\`${route.split(' ')[1]}\``);
    }
  });
});
