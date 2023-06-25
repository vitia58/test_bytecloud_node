import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Doctor, DoctorDocument } from 'src/models/Doctor';
import { AddDoctorDTO } from './dto/AddDoctorDTO';

@Injectable()
export class DoctorService {
  constructor(
    @InjectModel(Doctor.name)
    private readonly doctorModel: Model<DoctorDocument>,
  ) {}

  async createDoctor(doctor: AddDoctorDTO) {
    const checkIdExsists = await this.doctorModel.findOne({ id: doctor.id });
    if (checkIdExsists) throw new ForbiddenException('Duplicate');

    return new this.doctorModel(doctor).save();
  }
}
