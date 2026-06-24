import { Module } from '@nestjs/common';
import { EmbedderModule } from '../embedder/embedder.module';
import { RetrieveController } from './retrieve.controller';
import { RetrieveService } from './retrieve.service';

@Module({
  imports: [EmbedderModule],
  controllers: [RetrieveController],
  providers: [RetrieveService],
})
export class RetrieveModule {}