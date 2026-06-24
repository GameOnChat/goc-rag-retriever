import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RetrieveRequestDto {
  @IsString()
  @IsNotEmpty()
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  top_k?: number = 5;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  game_id?: number;
}