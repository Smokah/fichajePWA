export async function solicitarBiometria(): Promise<boolean> {
  if (typeof window !== 'undefined' && !window.PublicKeyCredential) {
    alert("Tu navegador o dispositivo no soporta autenticación biométrica.");
    return false;
  }

  // Challenge aleatorio simulado para levantar el prompt de FaceID/Huella
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  try {
    const credencial = await navigator.credentials.get({
      publicKey: {
        challenge,
        userVerification: "required", // Fuerza que pida huella o rostro
        timeout: 60000,
      }
    });
    
    return !!credencial;
  } catch (error) {
    console.warn("Autenticación biométrica cancelada o fallida:", error);
    return false;
  }
}
