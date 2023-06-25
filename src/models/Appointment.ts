import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Status } from 'src/common/enums/status.enum';
import { Patient } from './Patient';
import { Doctor } from './Doctor';

export type AppointmentDocument = Appointment & Document;

@Schema()
export class Appointment {
  _id: Types.ObjectId;

  @Prop({ required: true })
  idPatient: number;

  @Prop({ required: true })
  idDoctor: number;

  @Prop({ required: false })
  time: number;

  @Prop({ required: true, enum: Status, type: String })
  status: string;

  patient: Patient;

  doctor: Doctor;

  solved: boolean;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
