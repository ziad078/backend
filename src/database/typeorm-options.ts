import { join } from 'path'
import type { TypeOrmModuleOptions } from '@nestjs/typeorm'

export function buildTypeOrmOptions(): TypeOrmModuleOptions {
  const isProduction = process.env.NODE_ENV === 'production'
  const synchronize = !isProduction && process.env.DB_SYNCHRONIZE === 'true'

  return {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    autoLoadEntities: true,
    synchronize,
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsRun: process.env.DB_MIGRATIONS_RUN === 'true',
  }
}

export function buildDataSourceOptions() {
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    type: 'postgres' as const,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: !isProduction && process.env.DB_SYNCHRONIZE === 'true',
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  }
}
