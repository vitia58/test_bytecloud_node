import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { AddAppointmentDTO } from './dto/AddAppointmentDTO';
import {
  processValidate,
  validateArray,
} from 'src/common/validators/ValidateArray.function';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { SocketGateway } from 'src/socket/socket.gateway';
import { CACHE_MANAGER, CacheInterceptor } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { OnEvent } from '@nestjs/event-emitter';

@Controller('api/appointments')
@ApiTags('appointments')
@UseInterceptors(CacheInterceptor)
export class AppointmentController {
  constructor(
    private service: AppointmentService,
    private socket: SocketGateway,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Post()
  async createAppointment(@Body() appointment: AddAppointmentDTO) {
    const appointmentResult = await this.service.createAppointment(appointment);

    await this.updateAppointments();

    return appointmentResult;
  }

  @Post('bulk')
  @ApiBody({ type: [AddAppointmentDTO] })
  async createAppointments(@Body() appointments: Object[]) {
    const { errors, result } = await processValidate(
      await validateArray(appointments, AddAppointmentDTO),
      (appointment) => this.service.createAppointment(appointment),
    );

    if (result.length != 0) await this.updateAppointments();

    return { errors, appointments: result };
  }

  @Get()
  async getAppointments() {
    //Cache for method

    const appointment = await this.cacheManager
      .get<ReturnType<typeof this.service.getAppointments>>('appointments')
      .then((appointment) => appointment ?? this.service.getAppointments());

    this.cacheManager.set('appointments', appointment, 60000);

    return appointment;
  }

  @Patch()
  async approve() {
    const { appointments, modifiedAppointment } = await this.getAppointments();

    if (!this.service.checkEqual(appointments, modifiedAppointment)) {
      await this.service.approve({ appointments, modifiedAppointment });

      await this.updateAppointments();
    }
  }

  @Delete()
  async clear() {
    const clearResult = await this.service.clear();

    await this.updateAppointments();

    return clearResult;
  }

  async updateAppointments() {
    this.cacheManager.del('appointments');

    this.socket.sendObjectToClients(await this.getAppointments());
  }
}
