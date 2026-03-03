import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { LoggingService } from './observability/logging.service';
import { GlobalExceptionFilter } from './api/filters/http-exception.filter';
import { ConsumerService } from './worker/consumer.service';
import { initTracing, shutdownTracing } from './observability/tracing.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Initialise OpenTelemetry BEFORE NestFactory.create()
  // so auto-instrumentation hooks are registered for all libraries
  initTracing({
    serviceName: process.env.SERVICE_NAME || 'multi-agent-orchestrator',
    serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
    environment: process.env.ENVIRONMENT || 'development',
    otlpEndpoint: process.env.OTLP_ENDPOINT || 'http://localhost:4318',
  });

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use Pino logger
  app.useLogger(app.get(LoggingService));

  // Enable CORS
  app.enableCors();

  // Global validation pipe (replaces Pydantic request validation)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  const config = app.get(AppConfigService);

  if (config.orchestratorMode === 'worker') {
    // Worker mode: start SQS consumer, don't listen on HTTP
    logger.log('Starting in worker mode...');
    const consumer = app.get(ConsumerService);
    await consumer.start();
  } else if (config.orchestratorMode === 'all') {
    // Combined mode: start worker loop and HTTP API in a single process
    logger.log('Starting in all mode (api + worker)...');
    const consumer = app.get(ConsumerService);
    void consumer.start();
    await app.listen(config.port, config.host);
    logger.log(
      `Orchestrator API listening on ${config.host}:${config.port} (${config.environment})`,
    );
  } else {
    // API mode: start HTTP server
    await app.listen(config.port, config.host);
    logger.log(
      `Orchestrator API listening on ${config.host}:${config.port} (${config.environment})`,
    );
  }

  // Graceful shutdown: flush OTel spans
  const shutdown = async () => {
    logger.log('Shutting down...');
    await shutdownTracing();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap();
