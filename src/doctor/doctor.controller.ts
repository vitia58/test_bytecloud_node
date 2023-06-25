import { Body, Controller, Post } from '@nestjs/common';
import { AddDoctorDTO } from './dto/AddDoctorDTO';
import { DoctorService } from './doctor.service';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import {
  processValidate,
  validateArray,
} from 'src/common/validators/ValidateArray.function';

@Controller('api/doctors')
@ApiTags('doctors')
export class DoctorController {
  constructor(private service: DoctorService) {}

  @Post()
  createDoctor(@Body() doctor: AddDoctorDTO) {
    return this.service.createDoctor(doctor);
  }

  @Post('bulk')
  @ApiBody({ type: [AddDoctorDTO] })
  async createPatients(@Body() patients: Object[]) {
    const { errors, result } = await processValidate(
      await validateArray(patients, AddDoctorDTO),
      (doctor) => this.service.createDoctor(doctor),
    );

    return { errors, doctors: result };
  }
}
