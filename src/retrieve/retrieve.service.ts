import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EmbedderService } from '../embedder/embedder.service';
import { RetrieveRequestDto } from './dto/retrieve-request.dto';
import { RetrieveResponseDto } from './dto/retrieve-response.dto';

@Injectable()
export class RetrieveService {
  constructor(
    private readonly embedder: EmbedderService,
    private readonly db: DatabaseService,
  ) {}

  async retrieve(dto: RetrieveRequestDto): Promise<RetrieveResponseDto> {
    const embedding = await this.embedder.embedQuery(dto.query);
    const rows = await this.db.searchChunks(embedding, dto.top_k, dto.game_id);

    return {
      results: rows.map((row) => ({
        score: row.score,
        text: row.chunk.text,
        metadata: row.chunk.metadata,
      })),
    };
  }
}