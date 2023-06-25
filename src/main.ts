import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    httpsOptions: {
      cert: readFileSync(join(__dirname, '..', 'cert.pem')),
      ca: readFileSync(join(__dirname, '..', 'fullchain.pem')),
      key: readFileSync(join(__dirname, '..', 'privkey.pem')),
    },
  });

  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      stopAtFirstError: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Apointments backend')
    .setDescription('Apointment API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  app.enableCors();
  console.log(config.get('PORT'));
  await app.listen(config.get('PORT'));
}
bootstrap();
