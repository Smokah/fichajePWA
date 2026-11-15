export const RP_NAME = 'Fichajes PWA';
export const CHALLENGE_TTL_MINUTES = 5;

export function getWebAuthnConfig() {
  const rpID = (
    process.env.WEBAUTHN_RP_ID ||
    process.env.NEXT_PUBLIC_RP_ID ||
    'accesomovil.vercel.app'
  ).trim().toLowerCase();

  const configuredOrigin = (
    process.env.WEBAUTHN_ORIGIN ||
    process.env.NEXT_PUBLIC_ORIGIN ||
    `https://${rpID}`
  ).trim();

  let originUrl: URL;
  try {
    originUrl = new URL(configuredOrigin);
  } catch {
    throw new Error('WEBAUTHN_ORIGIN no es una URL válida.');
  }

  if (originUrl.protocol !== 'https:' && originUrl.hostname !== 'localhost') {
    throw new Error('WebAuthn requiere HTTPS en producción.');
  }

  if (originUrl.hostname.toLowerCase() !== rpID) {
    throw new Error(
      `Configuración WebAuthn inconsistente: el host de ORIGIN (${originUrl.hostname}) debe coincidir con RP_ID (${rpID}).`,
    );
  }

  return { rpID, origin: originUrl.origin };
}
