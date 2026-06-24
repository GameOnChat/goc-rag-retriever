import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { EmbedderModule } from './embedder/embedder.module';
import { RetrieveModule } from './retrieve/retrieve.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    EmbedderModule,
    RetrieveModule,
    HealthModule,
  ],
})
export class AppModule {}