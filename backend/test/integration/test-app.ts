import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

/**
 * Levanta una instancia real de Nest (AppModule completo) con la misma
 * configuración de pipes/CORS que main.ts, apuntando a la DB de test
 * (DATABASE_URL cargado desde .env.test en test/setup.ts).
 *
 * Usar en tests de integración vía supertest(app.getHttpServer()).
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  return app;
}
