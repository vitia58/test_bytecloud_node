import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min, ValidateIf } from 'class-validator';

export class AddAppointmentDTO {
  @Min(0)
  @IsNumber()
  @ApiProperty()
  idPatient: number;

  @Min(0)
  @IsNumber()
  @ApiProperty()
  idDoctor: number;

  @IsNumber()
  @Min(0)
  @Max(23)
  @ValidateIf((_, time) => time !== undefined)
  @ApiProperty()
  time: number;
}
