export const config = {
  port: Number(process.env.PORT ?? 3050),
  dbPath: process.env.DB_PATH ?? 'bondhu.db',
  jwtExpiresIn: '30d',
};
