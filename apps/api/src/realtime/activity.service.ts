import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ActivityDTO } from '@ridesrus/core';
import { RealtimeService } from './realtime.service';

/** Live operations feed for Fleet HQ. Keeps the last few hundred events in memory. */
@Injectable()
export class ActivityService {
  private readonly events: ActivityDTO[] = [];
  private static readonly MAX = 300;

  constructor(private readonly realtime: RealtimeService) {}

  record(type: ActivityDTO['type'], message: string, busCode?: string) {
    const event: ActivityDTO = { id: randomUUID(), type, message, busCode, at: Date.now() };
    this.events.unshift(event);
    if (this.events.length > ActivityService.MAX) this.events.length = ActivityService.MAX;
    this.realtime.toAdmins('activity', event);
  }

  recent(limit = 50): ActivityDTO[] {
    return this.events.slice(0, limit);
  }
}
