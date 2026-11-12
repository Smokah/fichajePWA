"use server";

import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const rpName = "Fichajes PWA";
const rpID = process.env.NEXT_PUBLIC_RP_ID || "localhost";
const origin = process.env.NEXT_PUBLIC_ORIGIN || `http://${rpID}:3000`;

export async function generarOpcionesRegistro(empleadoId: string) {
  // WebAuthn v10+ exige que el userID sea un Uint8Array
  const userID = new TextEncoder().encode(empleadoId);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID,
    userName: `empleado_${empleadoId}`,
    attestationType: "none",
    authenticatorSelection: {
      userVerification: "required",
      residentKey: "required",
    },
  });

  return options;
}

export async function verificarRegistro(empleadoId: string, response: any, expectedChallenge: string) {
  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      // En WebAuthn v10+ los datos están dentro de "credential"
      const { credential } = verification.registrationInfo;

      const { error } = await supabase
        .from('credenciales_biometricas')
        .insert([{
          empleado_id: empleadoId,
          credential_id: credential.id, // Ya viene como string Base64URL
          public_key: Buffer.from(credential.publicKey).toString('base64'),
          counter: credential.counter
        }]);

      if (error) return { success: false, error: error.message };
      return { success: true };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
  
  return { success: false, error: "Verificación fallida" };
}
