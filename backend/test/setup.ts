import { config } from 'dotenv';
import { resolve } from 'path';

// Carga variables de entorno específicas para tests (DB de test aislada).
config({ path: resolve(__dirname, '../.env.test') });
