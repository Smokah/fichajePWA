"use server";

import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const rpName = "Fichajes PWA";
const rpID = process.env.NEXT_PUBLIC_RP_ID || "localhost";
const origin = process.env.NEXT_PUBLIC_ORIGIN || `http://${rpID}:3000`;

// Función interna para buscar el ID real usando el email
async function getEmpleadoId(email: string) {
  const { data, error } = await supabase
    .from('empleados')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .single();
  if (error || !data) throw new Error("El email no está registrado en el sistema.");
  return data.id;
}

export async function generarOpcionesRegistro(email: string) {
  const empleadoId = await getEmpleadoId(email);
  const userID = new Uint8Array(Buffer.from(empleadoId));

  return await generateRegistrationOptions({
    rpName,
    rpID,
    userID,
    userName: email.toLowerCase().trim(), // El celular ahora guardará la huella bajo este correo
    attestationType: "none",
    authenticatorSelection: { userVerification: "required", residentKey: "required" },
  });
}

export async function verificarRegistro(email: string, response: any, expectedChallenge: string) {
  try {
    const empleadoId = await getEmpleadoId(email);
    const verification = await verifyRegistrationResponse({
      response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;
      const publicKeyJSON = JSON.stringify(Array.from(credential.publicKey));

      const { error } = await supabase.from('credenciales_biometricas').insert([{
        empleado_id: empleadoId, credential_id: credential.id, public_key: publicKeyJSON, counter: credential.counter
      }]);

      if (error) return { success: false, error: `Error BD: ${error.message}` };
      return { success: true };
    }
  } catch (error: any) {
    return { success: false, error: `Fallo WebAuthn: ${error.message}` };
  }
  return { success: false, error: "Verificación fallida" };
}

export async function generarOpcionesAutenticacion(email: string) {
  const empleadoId = await getEmpleadoId(email);
  const { data: credenciales, error } = await supabase.from('credenciales_biometricas').select('credential_id').eq('empleado_id', empleadoId);

  if (error || !credenciales || credenciales.length === 0) {
    throw new Error('No tienes ningún celular vinculado. Regístrate primero.');
  }

  return await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: credenciales.map(cred => ({ id: cred.credential_id, type: 'public-key' })),
  });
}

export async function verificarAutenticacion(email: string, response: any, expectedChallenge: string, tipoFichaje: string) {
  try {
    const empleadoId = await getEmpleadoId(email);
    const { data: credencial, error: credError } = await supabase.from('credenciales_biometricas').select('*').eq('credential_id', response.id).single();

    if (credError || !credencial) return { success: false, error: 'Credencial no encontrada en BD.' };

    const publicKeyUint8 = new Uint8Array(JSON.parse(credencial.public_key));

    const verification = await verifyAuthenticationResponse({
      response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID,
      credential: { id: credencial.credential_id, publicKey: publicKeyUint8, counter: Number(credencial.counter) },
    });

    if (verification.verified) {
      await supabase.from('credenciales_biometricas').update({ counter: verification.authenticationInfo.newCounter }).eq('credential_id', credencial.credential_id);
      
      const { error: fichajeError } = await supabase.from('fichajes').insert([{
        empleado_id: empleadoId, tipo: tipoFichaje.toLowerCase()
      }]);

      if (fichajeError) return { success: false, error: `Falló BD: ${fichajeError.message}` };
      return { success: true };
    }
  } catch (error: any) {
    return { success: false, error: `Fallo WebAuthn: ${error.message}` };
  }
  return { success: false, error: "Firma inválida" };
}
