import { config } from 'dotenv'
import { DataSource } from 'typeorm'
import { join } from 'path'
import { buildDataSourceOptions } from './typeorm-options'

config()

export default new DataSource({
  ...buildDataSourceOptions(),
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
})
