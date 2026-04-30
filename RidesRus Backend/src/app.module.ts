import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { TrackingModule } from './tracking/tracking.module';
import { PaymentModule } from './payment/payment.module';
import { BoardingModule } from './boarding/boarding.module';

@Module({
  imports: [AuthModule, PrismaModule, TrackingModule, PaymentModule, BoardingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
