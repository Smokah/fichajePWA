"use server";

import { 
  generateRegistrationOptions, 
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from "@simplewebauthn/server";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const rpName = "Fichajes PWA";
const rpID = process.env.NEXT_PUBLIC_RP_ID || "localhost";
const origin = process.env.NEXT_PUBLIC_ORIGIN || `http://${rpID}:3000`;

// ==========================================
// 1. REGISTRO
// ==========================================
export async function generarOpcionesRegistro(empleadoId: string) {
  const userID = new Uint8Array(Buffer.from(empleadoId));

  return await generateRegistrationOptions({
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
      const { credential } = verification.registrationInfo;

      // FIX: Guardamos los bytes crudos como Array para evitar corrupciones de Base64
      const publicKeyJSON = JSON.stringify(Array.from(credential.publicKey));

      const { error } = await supabase
        .from('credenciales_biometricas')
        .insert([{
          empleado_id: empleadoId,
          credential_id: credential.id,
          public_key: publicKeyJSON,
          counter: credential.counter
        }]);

      if (error) return { success: false, error: `Error BD: ${error.message}` };
      return { success: true };
    }
  } catch (error: any) {
    return { success: false, error: `Fallo WebAuthn (Alta): ${error.message}` };
  }
  return { success: false, error: "Verificación de registro fallida" };
}

// ==========================================
// 2. FICHAJE
// ==========================================
export async function generarOpcionesAutenticacion(empleadoId: string) {
  const { data: credenciales, error } = await supabase
    .from('credenciales_biometricas')
    .select('credential_id')
    .eq('empleado_id', empleadoId);

  if (error || !credenciales || credenciales.length === 0) {
    throw new Error('No tienes ningún celular vinculado. Regístrate primero.');
  }

  return await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: credenciales.map(cred => ({
      id: cred.credential_id,
      type: 'public-key',
    })),
  });
}

export async function verificarAutenticacion(
  empleadoId: string, 
  response: any, 
  expectedChallenge: string, 
  tipoFichaje: string
) {
  try {
    const { data: credencial, error: credError } = await supabase
      .from('credenciales_biometricas')
      .select('*')
      .eq('credential_id', response.id)
      .single();

    if (credError || !credencial) {
      return { success: false, error: 'Credencial no encontrada en la BD.' };
    }

    // FIX: Reconstruimos la llave pública exacta a partir del Array puro
    const publicKeyArray = JSON.parse(credencial.public_key);
    const publicKeyUint8 = new Uint8Array(publicKeyArray);

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credencial.credential_id,
        publicKey: publicKeyUint8,
        counter: Number(credencial.counter),
      },
    });

    if (verification.verified) {
      // Actualizamos contador de seguridad
      await supabase
        .from('credenciales_biometricas')
        .update({ counter: verification.authenticationInfo.newCounter })
        .eq('credential_id', credencial.credential_id);

      // Guardamos el fichaje forzando minúsculas para Postgres
      const { error: fichajeError } = await supabase
        .from('fichajes')
        .insert([{
          empleado_id: empleadoId,
          tipo: tipoFichaje.toLowerCase() 
        }]);

      // Si vemos este mensaje, la criptografía funcionó perfecto pero Postgres falló
      if (fichajeError) {
        return { success: false, error: `Huella Correcta, pero falló BD: ${fichajeError.message}` };
      }
      
      return { success: true };
    }
  } catch (error: any) {
    return { success: false, error: `Fallo WebAuthn (Comparación): ${error.message}` };
  }
  
  return { success: false, error: "Firma biométrica inválida" };
}
