/**
 * Utility for hashing and verifying individual file passwords in Infinity
 */
export async function hashItemPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`infinity_file_salt_${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyItemPassword(password: string, expectedHash: string): Promise<boolean> {
  if (!expectedHash) return true;
  const hash = await hashItemPassword(password);
  return hash === expectedHash;
}
