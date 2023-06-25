import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { TimeSchema } from './TimeSchema';

export type DoctorDocument = Doctor & Document;

@Schema()
export class Doctor {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true })
  id: number;

  @Prop({ required: true, type: TimeSchema })
  time: TimeSchema;

  @Prop({ required: false })
  name: string;

  @Prop({ required: false })
  birthday: Date;

  slots: number[];
}
export const DoctorSchema = SchemaFactory.createForClass(Doctor);
