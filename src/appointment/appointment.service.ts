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
    console.time();

    /* FETCHING DATA */

    const appointments: Appointment[] = await this.appointmentModel.aggregate([
      ...AppointmentPipeline.lookupDoctors(),
      ...AppointmentPipeline.lookupPatients(),
      {
        $addFields: {
          originalTime: '$time',
        },
      },
    ]);

    const hours = Array.from(new Array(24).keys());

    const doctorsList: Doctor[] = await this.doctorModel.find({
      id: {
        $in: appointments.map(({ idDoctor }) => idDoctor),
      },
    });

    const doctorsOriginal = doctorsList.reduce(
      (prev, doctor) => ({
        ...prev,
        [doctor.id]: {
          ...doctor,
          slots: hours.slice(doctor.time.from, doctor.time.to),
        },
      }),
      {} as Record<string, Doctor>,
    );

    const patientsList: Patient[] = await this.patientModel.find({
      id: {
        $in: appointments.map(({ idPatient }) => idPatient),
      },
    });

    const patientsOriginal = patientsList.reduce(
      (prev, patient) => ({
        ...prev,
        [patient.id]: {
          ...patient,
          slots: hours.slice(patient.time.from, patient.time.to),
        },
      }),
      {} as Record<string, Patient>,
    );

    console.timeLog();

    const sortObj = {
      [Status.RED]: -2,
      [Status.YELLOW]: -1,
      [Status.BLUE]: 0,
      [Status.GREEN]: 0,
    };

    let prevAppointments = appointments;
    let clonedAppointments = prevAppointments;
    const bestOptimisingResults = {};

    /* PROCESSING */

    const processSchedule = (appointments: Appointment[]) => {
      const clonedAppointments = cloneDeep(
        appointments.map((appointment) => ({
          ...appointment,
          solved: false,
        })),
      ).sort((a, b) => sortObj[a.status] - sortObj[b.status]);

      const patients = cloneDeep(patientsOriginal);
      const doctors = cloneDeep(doctorsOriginal);

      clonedAppointments.forEach(() => {
        if (clonedAppointments.every(({ solved }) => solved)) return;

        /* FINDING THE MOST IMPORTANT SLOT */

        const appointmentSlots = clonedAppointments
          .filter(({ solved }) => !solved)
          .map((appointment) => {
            const patient = patients[appointment.idPatient];

            const doctor = doctors[appointment.idDoctor];

            const slots = (patient?.slots ?? []).filter((slot) =>
              (doctor?.slots ?? []).includes(slot),
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
            foundAppointment.originalTime,
          );

          const selectedSlot = hasAvilableSlot
            ? foundAppointment.originalTime
            : firstAppointmentSlot.slots.at(-1);

          foundAppointment.status = hasAvilableSlot
            ? Status.GREEN
            : Status.BLUE;

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

      /* CALCULATING SCORE OF CURRENT RESULT */

      const scoreResults = clonedAppointments.reduce(
        (prev, cur) => ({
          ...prev,
          [cur.status]: prev[cur.status] + 1,
        }),
        { red: 0, green: 0, blue: 0 } as Record<Status, number>,
      );

      const score = -(
        scoreResults.green +
        (scoreResults.blue + scoreResults.red * appointments.length) *
          appointments.length
      );

      return { score, clonedAppointments };
    };

    do {
      prevAppointments = clonedAppointments;
      const withoutTime = processSchedule(
        clonedAppointments.map(({ originalTime, ...appointment }) => ({
          ...appointment,
          originalTime: null,
          originalTime2: originalTime,
        })),
      );
      const withTime = processSchedule(clonedAppointments);
      if (withTime.score >= withoutTime.score) {
        clonedAppointments = withTime.clonedAppointments;
      } else {
        clonedAppointments = withoutTime.clonedAppointments.map(
          ({
            originalTime2,
            ...appointment
          }: Appointment & { originalTime2: number }) => ({
            ...appointment,
            originalTime: originalTime2,
          }),
        );
      }
      Object.assign(bestOptimisingResults, {
        [Math.max(withTime.score, withoutTime.score)]: clonedAppointments,
      });

      /* MAKING SOME RETRIES TO FIND THE BEST OPTIMISED RESULT */
    } while (!this.checkEqual(prevAppointments, clonedAppointments));
    console.timeLog();

    /* FINDING THE BEST RESULT WITH MAX SCORE */

    const bestAppointmentSchedule: typeof clonedAppointments =
      bestOptimisingResults[
        Math.max(...Object.keys(bestOptimisingResults).map((key) => +key))
      ];

    bestAppointmentSchedule.forEach((appointment) => {
      if (appointment.status == Status.RED) appointment.originalTime;
    });

    /* SORTING FOR APPLICATION */

    const sortOrder: (keyof (typeof bestAppointmentSchedule)[0])[] = [
      'idPatient',
      'idDoctor',
      'time',
    ];

    const modifiedAppointment = bestAppointmentSchedule
      .map(({ solved, _id, originalTime, ...appointment }) => appointment)
      .sort((a, b) => {
        for (const order of sortOrder) {
          if (a[order] !== b[order]) {
            return (a[order] as number) - (b[order] as number);
          }
        }
        return 0;
      });
    console.timeEnd();

    return {
      modifiedAppointment,
      appointments: appointments.map(
        ({ originalTime, ...appointments }) => appointments,
      ),
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
