import { Test } from '@nestjs/testing';
import { TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HealthModule } from './health.module';

describe('HealthController', () => {
  it('answers the alive probe', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
    })
      // No database in unit tests: the readiness probe is not exercised here.
      .overrideProvider(TypeOrmHealthIndicator)
      .useValue({})
      .compile();

    const controller = moduleRef.get(HealthController);
    const result = controller.alive();

    expect(result.status).toBe('ok');
    expect(new Date(result.timestamp).getTime()).not.toBeNaN();
  });
});
