import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  Matches,
  Min,
  Validate,
  ValidateNested,
} from 'class-validator';
import { TimeValidator } from 'src/common/validators/TimeValidator';
import { TimeSchema } from 'src/models/TimeSchema';

export class AddPatientDTO {
  @Min(0)
  @IsInt()
  @ApiProperty()
  id: number;

  @ApiProperty({ type: TimeSchema, example: { from: 12, to: 13 } })
  @Validate(TimeValidator, { message: 'Incorrect time' })
  @ValidateNested()
  @Type(() => TimeSchema)
  @IsObject()
  time: TimeSchema;

  @IsOptional()
  @ApiProperty()
  @Matches(/^[A-Z][a-z]*(\s[A-Z][a-z]*)?$/, { message: 'Invalid name' })
  name: string;

  @IsOptional()
  @ApiProperty()
  @IsDateString({}, { message: 'Invalid birthday' })
  birthday: string;
}
