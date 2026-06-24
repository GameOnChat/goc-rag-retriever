import { Module } from '@nestjs/common';
import { EmbedderService } from './embedder.service';

@Module({
  providers: [EmbedderService],
  exports: [EmbedderService],
})
export class EmbedderModule {}