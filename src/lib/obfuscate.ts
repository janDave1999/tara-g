import { SALT } from "astro:env/client";
export const obfuscate = (text: string) => {
  const salted = text + "|" + SALT;
  // Convert to Base64 and swap some characters to make it non-standard
  return btoa(salted).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};  

export const deobfuscate = (encoded: string) => {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    return decoded.split("|")[0]; // Returns the original ID
  } catch {
    return null;
  }
};