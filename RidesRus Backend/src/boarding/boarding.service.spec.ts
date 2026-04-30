import { Test, TestingModule } from '@nestjs/testing';
import { BoardingService } from './boarding.service';

describe('BoardingService', () => {
  let service: BoardingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BoardingService],
    }).compile();

    service = module.get<BoardingService>(BoardingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
