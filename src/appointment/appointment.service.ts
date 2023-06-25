import { Injectable } from '@nestjs/common';
import { AddAppointmentDTO } from './dto/AddAppointmentDTO';
import { Appointment, AppointmentDocument } from 'src/models/Appointment';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Status } from 'src/common/enums/status.enum';
import { Doctor, DoctorDocument } from 'src/models/Doctor';
import { Patient, PatientDocument } from 'src/models/Patient';
import { AppointmentPipeline } from './appointment.pipeline';
import { cloneDeep } from 'lodash';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
    @InjectModel(Doctor.name)
    private readonly doctorModel: Model<DoctorDocument>,
    @InjectModel(Patient.name)
    private readonly patientModel: Model<PatientDocument>,
  ) {}

  async createAppointment(appointment: AddAppointmentDTO) {
    let status = Status.GREEN;
    const { idPatient, idDoctor, time } = appointment;

    if (!time) status = Status.RED;

    const doctor = await this.doctorModel.findOne({ id: idDoctor });
    if (doctor.time.from > time || doctor.time.to <= time) status = Status.RED;
    else {
      const patient = await this.patientModel.findOne({ id: idPatient });

      if (patient.time.from > time || patient.time.to <= time) {
        status = Status.RED;
      } else {
        const found = await this.appointmentModel.updateMany(
          {
            $or: [
              { idPatient, time },
              { idDoctor, time },
            ],
          },
          { status: Status.YELLOW },
        );

        if (found.modifiedCount > 0) {
          status = Status.YELLOW;
        }
      }
    }

    return new this.appointmentModel({ ...appointment, status }).save();
  }

  async getAppointments() {
    console.log('getAppointments()');

    const appointments: Appointment[] = await this.appointmentModel.aggregate([
      ...AppointmentPipeline.lookupDoctors(),
      ...AppointmentPipeline.lookupPatients(),
    ]);

    /* PREPARING SLOTS */

    const doctors: Doctor[] = await this.doctorModel.find({
      id: {
        $in: appointments.map(({ idDoctor }) => idDoctor),
      },
    });

    doctors.forEach((doctor) => {
      doctor.slots = Array.from(new Array(doctor.time.to).keys()).filter(
        (time) => time >= doctor.time.from,
      );
    });

    const patients: Patient[] = await this.patientModel.find({
      id: {
        $in: appointments.map(({ idPatient }) => idPatient),
      },
    });

    patients.forEach((patient) => {
      patient.slots = Array.from(new Array(patient.time.to).keys()).filter(
        (time) => time >= patient.time.from,
      );
    });

    /* CLONNING AND SORTING BY IMPORTANCE */

    const sortObj = {
      [Status.RED]: -2,
      [Status.YELLOW]: -1,
      [Status.GREEN]: 0,
    };

    let clonedAppointments = cloneDeep(appointments).sort(
      (a, b) => sortObj[a.status] - sortObj[b.status],
    );

    /* PROCESSING */

    clonedAppointments.forEach(() => {
      if (clonedAppointments.every(({ solved }) => solved)) return;

      /* FINDING THE MOST IMPORTANT SLOT */

      const appointmentSlots = clonedAppointments
        .filter(({ solved }) => !solved)
        .map((appointment) => {
          const patient = patients.find(
            (patient) => patient.id == appointment.idPatient,
          );

          const doctor = doctors.find(
            (doctor) => doctor.id == appointment.idDoctor,
          );

          const slots = patient.slots.filter((slot) =>
            doctor.slots.includes(slot),
          );

          return {
            patient,
            doctor,
            slots,
            appointment,
          };
        })
        .filter(({ slots }) => slots.length > 0)
        .sort((a, b) => {
          if (a.appointment.status !== b.appointment.status) {
            return (
              sortObj[a.appointment.status] - sortObj[b.appointment.status]
            );
          }

          return a.slots.length - b.slots.length;
        });

      if (appointmentSlots.length == 0) {
        // IF RUN OUT OF SLOTS
        clonedAppointments
          .filter(({ solved }) => !solved)
          .forEach((appointment) => {
            appointment.status = Status.RED;
          });
      } else {
        /* COMPLETING APPOINTMENT FOR EXSISTING OR NEW TIME */

        const firstAppointmentSlot = appointmentSlots[0];

        const foundAppointment = firstAppointmentSlot.appointment;
        foundAppointment.solved = true;

        const hasAvilableSlot = firstAppointmentSlot.slots.includes(
          foundAppointment.time,
        );

        const selectedSlot = hasAvilableSlot
          ? foundAppointment.time
          : firstAppointmentSlot.slots.at(-1);

        foundAppointment.status = hasAvilableSlot ? Status.GREEN : Status.BLUE;

        foundAppointment.time = selectedSlot;

        firstAppointmentSlot.patient.slots.splice(
          firstAppointmentSlot.patient.slots.indexOf(selectedSlot),
          1,
        );

        firstAppointmentSlot.doctor.slots.splice(
          firstAppointmentSlot.doctor.slots.indexOf(selectedSlot),
          1,
        );
      }
    });

    /* OPTIMIZING TRANSVERS */

    appointments.forEach((appointment) => {
      // FINDING SWAIPED TIME AFTER SOLVING SLOTS
      const found = clonedAppointments.find(
        ({ idDoctor, idPatient, time, status }) =>
          appointment.idDoctor == idDoctor &&
          appointment.idPatient == idPatient &&
          appointment.time == time &&
          appointment.status == Status.GREEN &&
          status == Status.BLUE,
      );
      if (found) found.status = Status.GREEN;
    });

    // CHECKING IS PREVIOUS VARIANT BETTER THEN NEW
    if (this.checkEqual(appointments, clonedAppointments)) {
      clonedAppointments = appointments;
    }

    /* SORTING FOR APPLICATION */

    const sortOrder: (keyof (typeof clonedAppointments)[0])[] = [
      'idPatient',
      'idDoctor',
      'time',
    ];

    const modifiedAppointment = clonedAppointments
      .map(({ solved, _id, ...appointment }) => appointment)
      .sort((a, b) => {
        for (const order of sortOrder) {
          if (a[order] !== b[order]) {
            return (a[order] as number) - (b[order] as number);
          }
        }
        return 0;
      });

    return {
      modifiedAppointment,
      appointments,
    };
  }

  async approve({
    modifiedAppointment,
  }: Awaited<ReturnType<typeof this.getAppointments>>) {
    const statusChangeTable = {
      [Status.BLUE]: Status.GREEN,
      [Status.GREEN]: Status.GREEN,
      [Status.YELLOW]: Status.GREEN,
      [Status.RED]: Status.RED,
    };

    const appointments = modifiedAppointment.map(
      ({ idPatient, idDoctor, time, status }) => ({
        idPatient,
        idDoctor,
        time,
        status: statusChangeTable[status],
      }),
    );

    const session = await this.appointmentModel.startSession();
    await session.withTransaction(async () => {
      await this.appointmentModel.deleteMany({}, { session });
      await this.appointmentModel.create(appointments, { session });
    });
  }

  async clear() {
    const collections: Model<any>[] = [
      this.appointmentModel,
      this.doctorModel,
      this.patientModel,
    ];

    const deletedResults = await Promise.all(
      collections.map((collection) => collection.deleteMany()),
    );

    const sumOfRows = deletedResults
      .map(({ deletedCount }) => deletedCount)
      .reduce((prev, rows) => prev + rows);

    return { count: sumOfRows };
  }

  checkEqual(
    appointments: Pick<Appointment, 'status'>[],
    newAppointments: Pick<Appointment, 'status'>[],
  ) {
    return (
      newAppointments.filter(({ status }) => status == Status.RED).length ==
        appointments.filter(({ status }) => status == Status.RED).length &&
      appointments.filter(({ status }) => status == Status.YELLOW).length == 0
    );
  }
}
