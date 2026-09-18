import { describe, it, expect } from 'vitest';
import { signToken, verifyToken, hashToken, hashPassword, verifyPassword } from './index';

const SECRET = 'test-secret';

describe('@smartcampus/auth — tokens', () => {
  const user = { id: 'u1', role: 'STUDENT', schoolId: 's1' };

  it('sign + verify devolve as reclamações', () => {
    const token = signToken(user, SECRET, 3600);
    const claims = verifyToken(token, SECRET);
    expect(claims.sub).toBe('u1');
    expect(claims.role).toBe('STUDENT');
    expect(claims.schoolId).toBe('s1');
    expect(claims.type).toBe('access');
    expect(claims.exp).toBeGreaterThan(claims.iat);
  });

  it('token inválido (assinatura errada) rejeita', () => {
    const token = signToken(user, 'other-secret');
    expect(() => verifyToken(token, SECRET)).toThrow();
  });

  it('token malformado rejeita', () => {
    expect(() => verifyToken('not-a-token', SECRET)).toThrow();
  });

  it('token expirado rejeita', () => {
    const token = signToken(user, SECRET, -10);
    expect(() => verifyToken(token, SECRET)).toThrow('expirado');
  });

  it('refresh token é assinado com type=refresh e verifica com segredo próprio', () => {
    const refresh = signToken(user, 'refresh-secret', 604800, 'refresh');
    const claims = verifyToken(refresh, 'refresh-secret', 'refresh');
    expect(claims.type).toBe('refresh');
    expect(claims.sub).toBe('u1');
  });

  it('access token não passa por verificação de refresh (e vice-versa)', () => {
    const access = signToken(user, SECRET, 3600, 'access');
    const refresh = signToken(user, SECRET, 3600, 'refresh');
    expect(() => verifyToken(access, SECRET, 'refresh')).toThrow();
    expect(() => verifyToken(refresh, SECRET, 'access')).toThrow();
  });

  it('hashToken é estável e irreversível', () => {
    const a = hashToken('segredo');
    expect(a).toBe(hashToken('segredo'));
    expect(a).not.toBe('segredo');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('@smartcampus/auth — passwords', () => {
  it('hash + verify correcto', () => {
    const stored = hashPassword('admin123');
    expect(stored).toContain(':');
    expect(verifyPassword('admin123', stored)).toBe(true);
    expect(verifyPassword('admin12', stored)).toBe(false);
  });
});