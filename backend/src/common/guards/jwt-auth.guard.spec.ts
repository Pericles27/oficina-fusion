import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeContext(headers: Record<string, string> = {}): ExecutionContext {
  const request: any = { headers, user: undefined };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let jwtService: { verify: ReturnType<typeof vi.fn> };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jwtService = { verify: vi.fn() };
    guard = new JwtAuthGuard(jwtService as any);
  });

  it('rechaza cuando no hay header Authorization', () => {
    const ctx = makeContext({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rechaza cuando el header no usa esquema Bearer', () => {
    const ctx = makeContext({ authorization: 'Basic abc123' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rechaza cuando el token es inválido o expiró', () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const ctx = makeContext({ authorization: 'Bearer bad.token' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('permite el acceso y adjunta el payload a request.user con token válido', () => {
    const payload = { id: 'u1', username: 'jdoe', roles: ['ADMIN'] };
    jwtService.verify.mockReturnValue(payload);

    const request: any = { headers: { authorization: 'Bearer good.token' } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.user).toEqual(payload);
  });
});
