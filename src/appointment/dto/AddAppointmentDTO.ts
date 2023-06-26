import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min, ValidateIf } from 'class-validator';

export class AddAppointmentDTO {
  @Min(0)
  @IsInt()
  @ApiProperty()
  idPatient: number;

  @Min(0)
  @IsInt()
  @ApiProperty()
  idDoctor: number;

  @IsInt()
  @Min(0)
  @Max(23)
  @ValidateIf((_, time) => time !== undefined)
  @ApiProperty()
  time: number;
}
