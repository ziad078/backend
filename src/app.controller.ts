import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { AppService } from './app.service'
import { Public } from './users/decorators/public.decorator'

@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness and dependency health check' })
  health() {
    return this.appService.getHealth(this.dataSource)
  }
}
