import bcrypt from 'bcryptjs'

export async function hashPassword(plano: string): Promise<string> {
  return bcrypt.hash(plano, 10)
}

export async function verificarPassword(plano: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plano, hash)
}
