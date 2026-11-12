"use server";

import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import { createClient } from '@supabase/supabase-js';

// Inicializamos Supabase para el entorno de servidor
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Variables requeridas por WebAuthn para evitar phishing
const rpName = "Fichajes PWA";
const rpID = process.env.NEXT_PUBLIC_RP_ID || "localhost";
const origin = process.env.NEXT_PUBLIC_ORIGIN || `http://${rpID}:3000`;

export async function generarOpcionesRegistro(empleadoId: string) {
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: typeof Buffer !== 'undefined' ? Buffer.from(empleadoId).toString('base64') : empleadoId,
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
      const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

      // Guardamos la credencial y la clave pública en formato Base64
      const { error } = await supabase
        .from('credenciales_biometricas')
        .insert([{
          empleado_id: empleadoId,
          credential_id: Buffer.from(credentialID).toString('base64'),
          public_key: Buffer.from(credentialPublicKey).toString('base64'),
          counter: counter
        }]);

      if (error) return { success: false, error: error.message };
      return { success: true };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
  
  return { success: false, error: "Verificación fallida" };
}
