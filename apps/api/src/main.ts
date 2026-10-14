import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { ServerOptions } from 'socket.io';
import { AppModule } from './app.module';
import { AppConfig, loadConfig } from './config';

/** Socket.IO with the same CORS allow-list as HTTP. */
class CorsIoAdapter extends IoAdapter {
  constructor(
    app: NestExpressApplication,
    private readonly origins: string[],
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, { ...options, cors: { origin: this.origins, credentials: false } });
  }
}

export async function createApp(config: AppConfig) {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), {
    logger: config.NODE_ENV === 'test' ? false : ['log', 'warn', 'error'],
  });
  app.set('trust proxy', 1); // behind Render/Fly/ALB, so rate limits see real client IPs
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: config.corsOrigins, credentials: false });
  app.useWebSocketAdapter(new CorsIoAdapter(app, config.corsOrigins));
  app.enableShutdownHooks();
  return app;
}

async function bootstrap() {
  const config = loadConfig();
  const app = await createApp(config);
  await app.listen(config.PORT, '0.0.0.0');
  new Logger('RidesRus').log(
    `API on :${config.PORT} · demo=${config.DEMO_MODE} · payments=${config.PAYMENTS_PROVIDER} · cors=${config.corsOrigins.join(',')}`,
  );
}

if (require.main === module) void bootstrap();
