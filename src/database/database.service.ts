import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import CircuitBreaker from 'opossum';
import pRetry from 'p-retry';

export interface ChunkRow {
  id: number;
  chunk: { text: string; metadata: Record<string, unknown> };
  score: number;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;
  private breaker!: CircuitBreaker;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.pool = new Pool({
      user: this.config.getOrThrow<string>('POSTGRES_USER'),
      host: this.config.get<string>('POSTGRES_HOST', 'db'),
      database: this.config.getOrThrow<string>('POSTGRES_DB'),
      password: this.config.getOrThrow<string>('POSTGRES_PASSWORD'),
      port: this.config.get<number>('POSTGRES_PORT', 5432),
    });

    this.breaker = new CircuitBreaker(
      (embedding: number[], topK: number, gameId?: number) =>
        this.executeSearch(embedding, topK, gameId),
      {
        timeout: 5000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        volumeThreshold: 5,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async searchChunks(
    embedding: number[],
    topK = 5,
    gameId?: number,
  ): Promise<ChunkRow[]> {
    return pRetry(() => this.breaker.fire(embedding, topK, gameId) as Promise<ChunkRow[]>, {
      retries: 3,
      minTimeout: 200,
      factor: 2,
    });
  }

  private async executeSearch(
    embedding: number[],
    topK: number,
    gameId?: number,
  ): Promise<ChunkRow[]> {
    const sql = `
      SELECT
        c.id,
        c.chunk,
        (c.embedding <#> $1::vector) * -1 AS score
      FROM t_fandom_document_chunks c
      WHERE c.embedding IS NOT NULL
        AND ($3::bigint IS NULL OR c.game_id = $3)
      ORDER BY c.embedding <#> $1::vector
      LIMIT $2
    `;

    const result = await this.pool.query<ChunkRow>(sql, [
      `[${embedding.join(',')}]`,
      topK,
      gameId ?? null,
    ]);

    return result.rows;
  }
}