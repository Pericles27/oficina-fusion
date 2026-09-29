/**
 * Único punto de acceso al secreto JWT.
 * Falla al arrancar si no está definido, en vez de degradar a un secreto
 * de desarrollo conocido (lo que permitiría forjar tokens en producción).
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET no está definido o tiene menos de 32 caracteres. ' +
        'Generar con: openssl rand -base64 48',
    );
  }
  return secret;
}
