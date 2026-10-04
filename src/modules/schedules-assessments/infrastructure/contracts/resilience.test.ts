import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker, CircuitOpenError, TtlCache, withRetry } from './resilience';

describe('CircuitBreaker', () => {
  const options = { name: 'teste', failureThreshold: 3, resetTimeoutMs: 1000 };

  it('começa fechado e permite chamadas', () => {
    const breaker = new CircuitBreaker(options);
    expect(breaker.state).toBe('CLOSED');
    expect(() => breaker.assertCallable()).not.toThrow();
  });

  it('abre ao atingir o limite de falhas e deixa de chamar o serviço', () => {
    const breaker = new CircuitBreaker(options);
    breaker.onFailure();
    breaker.onFailure();
    expect(breaker.state).toBe('CLOSED');
    breaker.onFailure();
    expect(breaker.state).toBe('OPEN');
    expect(() => breaker.assertCallable()).toThrow(CircuitOpenError);
  });

  it('uma falha em estado fechado não conta quando o circuito volta a fechar', () => {
    const breaker = new CircuitBreaker(options);
    breaker.onFailure();
    breaker.onFailure();
    breaker.onSuccess();
    expect(breaker.state).toBe('CLOSED');
    expect(breaker.failureCount).toBe(0);
    breaker.onFailure();
    expect(breaker.state).toBe('CLOSED');
  });

  it('passa a HALF_OPEN após o tempo de reset e fecha se houver sucesso', () => {
    let now = 0;
    const breaker = new CircuitBreaker({ ...options, now: () => now });
    breaker.onFailure();
    breaker.onFailure();
    breaker.onFailure();
    expect(breaker.state).toBe('OPEN');

    now = 999;
    expect(breaker.state).toBe('OPEN');
    now = 1000;
    expect(breaker.state).toBe('HALF_OPEN');
    expect(() => breaker.assertCallable()).not.toThrow();

    breaker.onSuccess();
    expect(breaker.state).toBe('CLOSED');
    expect(breaker.failureCount).toBe(0);
  });

  it('uma falha em HALF_OPEN reabre imediatamente o circuito', () => {
    let now = 0;
    const breaker = new CircuitBreaker({ ...options, now: () => now });
    for (let i = 0; i < 3; i += 1) breaker.onFailure();
    now = 1000;
    expect(breaker.state).toBe('HALF_OPEN');
    breaker.onFailure();
    expect(breaker.state).toBe('OPEN');
  });

  it('indica quanto tempo falta para poder tentar de novo', () => {
    let now = 0;
    const breaker = new CircuitBreaker({ name: 'financeiro', failureThreshold: 1, resetTimeoutMs: 5000, now: () => now });
    breaker.onFailure();
    now = 2000;
    try {
      breaker.assertCallable();
      throw new Error('deveria ter lançado');
    } catch (error) {
      expect(error).toBeInstanceOf(CircuitOpenError);
      expect((error as CircuitOpenError).retryAfterMs).toBe(3000);
      expect((error as CircuitOpenError).circuit).toBe('financeiro');
    }
  });
});

describe('withRetry', () => {
  const noSleep = { sleep: async () => undefined };

  it('devolve o resultado sem repetir quando a primeira tentativa funciona', async () => {
    const op = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(op, { attempts: 3, baseDelayMs: 1, maxDelayMs: 5, ...noSleep });
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('repete até ao limite e devolve o resultado de uma tentativa bem sucedida', async () => {
    const op = vi.fn().mockRejectedValueOnce(new Error('temporário')).mockResolvedValue('ok');
    const result = await withRetry(op, { attempts: 3, baseDelayMs: 1, maxDelayMs: 5, ...noSleep });
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(2);
  });

  it('faz exactamente o número de tentativas configurado e propaga o último erro', async () => {
    const op = vi.fn().mockRejectedValue(new Error('sempre falha'));
    await expect(withRetry(op, { attempts: 4, baseDelayMs: 1, maxDelayMs: 5, ...noSleep })).rejects.toThrow('sempre falha');
    expect(op).toHaveBeenCalledTimes(4);
  });

  it('respeita shouldRetry e não repete erros não transitórios', async () => {
    const op = vi.fn().mockRejectedValue(new Error('400 bad request'));
    await expect(
      withRetry(op, { attempts: 3, baseDelayMs: 1, maxDelayMs: 5, shouldRetry: () => false, ...noSleep }),
    ).rejects.toThrow('400 bad request');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('faz backoff exponencial limitado por maxDelayMs', async () => {
    const delays: number[] = [];
    await withRetry(
      async () => {
        throw new Error('falha');
      },
      {
        attempts: 5,
        baseDelayMs: 10,
        maxDelayMs: 25,
        sleep: async (ms) => {
          delays.push(ms);
        },
      },
    ).catch(() => undefined);
    expect(delays).toEqual([10, 20, 25, 25]);
  });

  it('nunca faz menos de uma tentativa', async () => {
    const op = vi.fn().mockResolvedValue('ok');
    expect(await withRetry(op, { attempts: 0, baseDelayMs: 1, maxDelayMs: 1, ...noSleep })).toBe('ok');
    expect(op).toHaveBeenCalledTimes(1);
  });
});

describe('TtlCache', () => {
  it('carrega uma vez e reutiliza o valor em cache', async () => {
    let now = 0;
    const load = vi.fn().mockResolvedValue(['a']);
    const cache = new TtlCache<string[]>({ ttlMs: 1000, now: () => now, load });

    expect(await cache.get()).toEqual(['a']);
    expect(await cache.get()).toEqual(['a']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('volta a carregar quando o TTL expira', async () => {
    let now = 0;
    const load = vi.fn().mockResolvedValueOnce(['a']).mockResolvedValueOnce(['b']);
    const cache = new TtlCache<string[]>({ ttlMs: 1000, now: () => now, load });

    expect(await cache.get()).toEqual(['a']);
    now = 1001;
    expect(await cache.get()).toEqual(['b']);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('invalidate() força o próximo carregamento', async () => {
    const load = vi.fn().mockResolvedValue(['a']);
    const cache = new TtlCache<string[]>({ ttlMs: 10_000, load });
    await cache.get();
    cache.invalidate();
    await cache.get();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('partilha a mesma promessa quando várias chamadas coincidem (evita stampede)', async () => {
    let now = 0;
    let resolveLoad: (value: string[]) => void = () => undefined;
    const load = vi.fn().mockImplementation(() => new Promise<string[]>((resolve) => (resolveLoad = resolve)));
    const cache = new TtlCache<string[]>({ ttlMs: 1000, now: () => now, load });

    const first = cache.get();
    const second = cache.get();
    resolveLoad(['x']);
    expect(await first).toEqual(['x']);
    expect(await second).toEqual(['x']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('usa o fallback em onError quando o carregamento falha', async () => {
    const cache = new TtlCache<string[]>({
      ttlMs: 1000,
      load: async () => {
        throw new Error('upstream em baixo');
      },
      onError: () => ['do-cache-antigo'],
    });
    expect(await cache.get()).toEqual(['do-cache-antigo']);
  });

  it('propaga o erro quando não há fallback', async () => {
    const cache = new TtlCache<string[]>({
      ttlMs: 1000,
      load: async () => {
        throw new Error('upstream em baixo');
      },
    });
    await expect(cache.get()).rejects.toThrow('upstream em baixo');
  });

  it('propaga o erro quando o fallback devolve undefined', async () => {
    const cache = new TtlCache<string[]>({
      ttlMs: 1000,
      load: async () => {
        throw new Error('upstream em baixo');
      },
      onError: () => undefined,
    });
    await expect(cache.get()).rejects.toThrow('upstream em baixo');
  });

  it('não deixa o valor em cache quando a carga falha', async () => {
    let now = 0;
    const load = vi
      .fn()
      .mockResolvedValueOnce(['ok'])
      .mockRejectedValueOnce(new Error('caiu'))
      .mockResolvedValueOnce(['novo']);
    const cache = new TtlCache<string[]>({ ttlMs: 500, now: () => now, load });

    expect(await cache.get()).toEqual(['ok']);
    now = 600;
    await expect(cache.get()).rejects.toThrow('caiu');
    expect(await cache.get()).toEqual(['novo']);
  });
});
