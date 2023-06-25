import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AddPatientDTO } from './dto/AddPatientDTO';
import { Patient, PatientDocument } from 'src/models/Patient';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class PatientsService {
  constructor(
    @InjectModel(Patient.name)
    private readonly patientModel: Model<PatientDocument>,
  ) {}

  async createPatient(patient: AddPatientDTO) {
    const checkIdExsists = await this.patientModel.findOne({ id: patient.id });
    if (checkIdExsists) throw new ForbiddenException('Duplicate');

    return new this.patientModel(patient).save();
  }
}
