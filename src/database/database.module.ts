import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { addCircuitBreakerSupportTo } from 'nest-circuit-breaker';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [
    {
      provide: DatabaseService,
      useFactory: (config: ConfigService) => {
        const service = new DatabaseService(config);
        addCircuitBreakerSupportTo(service);
        return service;
      },
      inject: [ConfigService],
    },
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}