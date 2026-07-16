import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'

export type HealthStatus = {
  status: 'ok' | 'degraded'
  timestamp: string
  checks: {
    database: 'up' | 'down'
  }
}

@Injectable()
export class AppService {
  async getHealth(dataSource: DataSource): Promise<HealthStatus> {
    let database: 'up' | 'down' = 'down'

    try {
      await dataSource.query('SELECT 1')
      database = 'up'
    } catch {
      database = 'down'
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: { database },
    }
  }
}
