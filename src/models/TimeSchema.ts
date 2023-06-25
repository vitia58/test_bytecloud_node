import { Prop } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

export class TimeSchema {
  @Prop()
  @ApiProperty({ example: 10 })
  from: number;

  @Prop()
  @ApiProperty({ example: 12 })
  to: number;
}
