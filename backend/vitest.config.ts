import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import swc from 'unplugin-swc';

// NestJS depende de metadata de decoradores TS (emitDecoratorMetadata) para
// resolver la inyección de dependencias en tiempo de ejecución. El
// transformador esbuild por defecto de Vite/Vitest NO emite esa metadata,
// lo que rompe el DI en tests de integración (providers quedan `undefined`
// en los controllers). unplugin-swc transpila con swc (igual que @nestjs/cli
// en modo swc) respetando decorators + metadata.
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    root: '.',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.module.ts',
        'src/**/*.dto.ts',
        'src/**/dtos.ts',
        'src/main.ts',
        'src/**/*.spec.ts',
      ],
    },
    testTimeout: 20000,
    hookTimeout: 30000,
    setupFiles: ['./test/setup.ts'],
    // Los tests de integración comparten una única base Postgres de test
    // (localhost:5543/oficina_fusion_test) y cada suite hace cleanDatabase()
    // en beforeEach. Si Vitest corriera los archivos de test en paralelo,
    // el cleanDatabase() de una suite borraría filas que otra suite está
    // usando en simultáneo. Forzamos ejecución secuencial de archivos.
    fileParallelism: false,
  },
});
