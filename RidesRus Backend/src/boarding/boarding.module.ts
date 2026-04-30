import { Module } from '@nestjs/common';
import { BoardingService } from './boarding.service';
import { BoardingController } from './boarding.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [PrismaModule, PaymentModule],
  providers: [BoardingService],
  controllers: [BoardingController],
})
export class BoardingModule {}
