import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking/tracking.gateway';
import { TrackingService } from './tracking.service';

@Module({
  providers: [TrackingGateway, TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
