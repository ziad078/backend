import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import type { ValidationError } from 'class-validator'
import { AllExceptionsFilter } from './common/filters/all-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  })

  const flattenValidationErrors = (
    errors: ValidationError[],
    parentPath = '',
    out: Record<string, string> = {},
  ) => {
    for (const err of errors) {
      const path = parentPath ? `${parentPath}.${err.property}` : err.property

      const constraints = Object.values(err.constraints ?? {})
      if (constraints.length > 0) {
        out[path] = constraints[0]
      }

      if (err.children && err.children.length > 0) {
        flattenValidationErrors(err.children, path, out)
      }
    }

    return out
  }

  // app.useGlobalFilters(new AllExceptionsFilter())
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        return new BadRequestException(flattenValidationErrors(errors))
      },
    }),
  )

  const corsOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  app.enableCors({
    origin: corsOrigins?.length ? corsOrigins : true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  })

  app.setGlobalPrefix('api')

  const config = new DocumentBuilder()
    .setTitle('Ithraa Backend API')
    .setDescription(
      'RESTful API for the Ithraa child evaluation and educational services platform. ' +
        'Supports multi-role authentication (Admin, Organization Owner, Teacher, Parent, Enricher), ' +
        'child evaluations with multiple scoring strategies, deal/proposal marketplace, payment processing, and more.',
    )
    .setVersion('1.0.0')
    .setContact('Ithraa Support', '', 'support@ithraa.com')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT-auth')
    .addTag('auth', 'Authentication & user registration')
    .addTag('users', 'User management (admin & self-service)')
    .addTag('teachers', 'Teacher management by organization owners')
    .addTag('parents', 'Parent lookup by phone')
    .addTag('enrichers (service provider)', 'Service provider deal/proposal operations')
    .addTag('organizations', 'Organization (school/center) management')
    .addTag('children', 'Institutional child management')
    .addTag('parent-children', 'Private child management by parents')
    .addTag('child-transfers', 'Child transfer requests between organizations')
    .addTag('classes', 'Class management within organizations')
    .addTag('grades', 'Grade level management')
    .addTag('evaluations', 'Evaluation template & scoring administration')
    .addTag('evaluation-attempts', 'Evaluation attempt lifecycle (start, save, submit, approve)')
    .addTag('admin-private-attempts', 'Admin approval of private extra attempts')
    .addTag('owner-evaluation-results', 'Organization owner evaluation reports and dashboards')
    .addTag('deals', 'Deal/opportunity marketplace')
    .addTag('proposals', 'Enricher proposal management')
    .addTag('activities', 'Activity categories for deals')
    .addTag('payments', 'Payment processing via Moyasar')
    .addTag('notifications', 'In-app and email notifications')
    .addTag('uploads', 'File uploads (images, PDFs)')
    .addTag('capacity-requests', 'Child capacity increase requests')
    .addTag('sessions', 'User session management')
    .build()

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) => methodKey,
  })

  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Ithraa API Docs',
  })

  await app.listen(process.env.PORT ?? 3000)
}
void bootstrap()
