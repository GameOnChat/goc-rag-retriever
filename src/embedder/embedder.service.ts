import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class EmbedderService implements OnModuleInit {
  private openai!: OpenAI;
  private dimensions!: number;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.openai = new OpenAI({
      apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
    });
    this.dimensions = parseInt(this.config.get<string>('EMBEDDING_DIMENSIONS', '384'), 10);
  }

  async embedQuery(text: string): Promise<number[]> {
    if (!text?.trim()) {
      throw new BadRequestException('Query text must not be empty');
    }

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: this.dimensions,
    });

    return response.data[0].embedding;
  }
}