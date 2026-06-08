function parseOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS;
  if (raw) return raw.split(',').map((s) => s.trim()).filter(Boolean);
  return [
    'https://wa.client-flow.xyz',
    'http://localhost:5173',
    'http://localhost:3050',
    'http://localhost:3060',
  ];
}

export const config = {
  port: Number(process.env.PORT ?? 3050),
  dbPath: process.env.DB_PATH ?? 'bondhu.db',
  jwtExpiresIn: '30d',
  /** Browser origins allowed to read API responses (CORS). Native apps / curl
   *  send no Origin header and are always allowed. */
  corsOrigins: parseOrigins(),
  isTest: process.env.NODE_ENV === 'test',
};
