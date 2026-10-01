import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ETicketsService } from './e-tickets.service';

function makePrismaMock() {
  return {
    cliente: { findUnique: vi.fn() },
    operacion: { findUnique: vi.fn() },
    eticket: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

const fullEticket = {
  id: 'et-1',
  numero: 1,
  codigo: 'ET-0001',
  ts: new Date(),
  operationId: null,
  clienteId: 'cl-1',
  estado: 'pendiente',
  metodoEntrega: 'en_mano',
  direccionEntrega: 'Av. Siempreviva 742',
  telefonoContacto: '11 5555-5555',
  nombreRecibe: 'Juan Perez',
  horarioEntrega: '14 a 16',
  banco: null,
  cuentaDeposito: null,
  instrucciones: 'Pedir DNI',
  confirmadoPor: null,
  confirmadoEn: null,
  creadoPor: 'u1',
  creadoEn: new Date(),
  // Campos económicos — esto es lo que NUNCA debe llegar a un cadete
  monedaEntregar: 'USD',
  montoEntregar: '1000.0000',
  monedaRecibir: 'ARS',
  montoRecibir: '1250000.0000',
};

describe('ETicketsService — F5 fuga de datos económicos al cadete', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: ETicketsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ETicketsService(prisma as any);
  });

  describe('findAll con scopeCadete=true', () => {
    it('fuerza estado=pendiente sin importar qué estado venga por query (ignora el input del cliente)', async () => {
      prisma.eticket.findMany.mockResolvedValue([]);
      prisma.eticket.count.mockResolvedValue(0);

      await service.findAll({ estado: 'confirmado', scopeCadete: true });

      const call = prisma.eticket.findMany.mock.calls[0][0];
      expect(call.where.estado).toBe('pendiente');
    });

    it('usa select explícito y NUNCA incluye montoEntregar/montoRecibir/monedas', async () => {
      prisma.eticket.findMany.mockResolvedValue([]);
      prisma.eticket.count.mockResolvedValue(0);

      await service.findAll({ scopeCadete: true });

      const call = prisma.eticket.findMany.mock.calls[0][0];
      expect(call.select).toBeDefined();
      expect(call.select.montoEntregar).toBeUndefined();
      expect(call.select.montoRecibir).toBeUndefined();
      expect(call.select.monedaEntregar).toBeUndefined();
      expect(call.select.monedaRecibir).toBeUndefined();
      // No debe usar `include` (que arrastraría todo el modelo)
      expect(call.include).toBeUndefined();
    });
  });

  describe('findAll sin scopeCadete (ADMIN/OPERADOR)', () => {
    it('no fuerza el estado y permite el filtro que venga por query', async () => {
      prisma.eticket.findMany.mockResolvedValue([]);
      prisma.eticket.count.mockResolvedValue(0);

      await service.findAll({ estado: 'confirmado' });

      const call = prisma.eticket.findMany.mock.calls[0][0];
      expect(call.where.estado).toBe('confirmado');
      // Sin select: ADMIN/OPERADOR reciben el objeto completo
      expect(call.select).toBeUndefined();
    });
  });

  describe('findOneForCadete', () => {
    it('usa select explícito, nunca destructuring, y excluye campos económicos', async () => {
      // El mock de Prisma con `select` sólo devolvería los campos pedidos;
      // acá devolvemos el objeto completo para probar que el SERVICE pide
      // el select correcto (la responsabilidad de filtrar es de Prisma,
      // pero el contrato lo fija el `select` que mandamos).
      prisma.eticket.findUnique.mockResolvedValue(fullEticket);

      await service.findOneForCadete('et-1');

      const call = prisma.eticket.findUnique.mock.calls[0][0];
      expect(call.select).toBeDefined();
      expect(call.select.montoEntregar).toBeUndefined();
      expect(call.select.montoRecibir).toBeUndefined();
      expect(call.select.monedaEntregar).toBeUndefined();
      expect(call.select.monedaRecibir).toBeUndefined();
    });

    it('lanza NotFoundException si el e-ticket no existe', async () => {
      prisma.eticket.findUnique.mockResolvedValue(null);
      await expect(service.findOneForCadete('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne (vista completa, ADMIN/OPERADOR)', () => {
    it('no usa select — devuelve el objeto completo incluyendo campos económicos', async () => {
      prisma.eticket.findUnique.mockResolvedValue(fullEticket);
      const result = await service.findOne('et-1');

      const call = prisma.eticket.findUnique.mock.calls[0][0];
      expect(call.select).toBeUndefined();
      expect(result.montoEntregar).toBeDefined();
    });
  });
});
