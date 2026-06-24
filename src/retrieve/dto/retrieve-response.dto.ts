export class RetrieveResultItem {
  score!: number;
  text!: string;
  metadata!: Record<string, unknown>;
}

export class RetrieveResponseDto {
  results!: RetrieveResultItem[];
}