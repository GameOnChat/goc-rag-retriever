import { Body, Controller, Post } from '@nestjs/common';
import { RetrieveRequestDto } from './dto/retrieve-request.dto';
import { RetrieveResponseDto } from './dto/retrieve-response.dto';
import { RetrieveService } from './retrieve.service';

@Controller('retrieve')
export class RetrieveController {
  constructor(private readonly retrieveService: RetrieveService) {}

  @Post()
  retrieve(@Body() dto: RetrieveRequestDto): Promise<RetrieveResponseDto> {
    return this.retrieveService.retrieve(dto);
  }
}