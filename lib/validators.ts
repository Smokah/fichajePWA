export function normalizeEmail(email: string): string {
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!normalized || normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Ingresá un correo electrónico válido.');
  }
  return normalized;
}

export function normalizeBranchCode(code: string): string {
  const normalized = String(code ?? '').trim().toLowerCase();
  if (!/^[a-f0-9]{16}$/.test(normalized)) {
    throw new Error('El código de sucursal debe tener 16 caracteres hexadecimales.');
  }
  return normalized;
}

export function normalizeName(name: string): string {
  const normalized = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > 120) {
    throw new Error('Ingresá un nombre válido (entre 2 y 120 caracteres).');
  }
  return normalized;
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
