import { Prop } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class TimeSchema {
  @Prop()
  @IsInt()
  @ApiProperty({ example: 10 })
  from: number;

  @Prop()
  @IsInt()
  @ApiProperty({ example: 12 })
  to: number;
}
