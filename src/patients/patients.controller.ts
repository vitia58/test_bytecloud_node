import { Body, Controller, Post } from '@nestjs/common';
import { AddPatientDTO } from './dto/AddPatientDTO';
import { PatientsService } from './patients.service';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import {
  processValidate,
  validateArray,
} from 'src/common/validators/ValidateArray.function';

@Controller('api/patients')
@ApiTags('patients')
export class PatientsController {
  constructor(private service: PatientsService) {}

  @Post()
  createPatient(@Body() patient: AddPatientDTO) {
    return this.service.createPatient(patient);
  }

  @Post('bulk')
  @ApiBody({ type: [AddPatientDTO] })
  async createPatients(@Body() patients: Object[]) {
    const { errors, result } = await processValidate(
      await validateArray(patients, AddPatientDTO),
      (patient) => this.service.createPatient(patient),
    );

    return { errors, patients: result };
  }
}
