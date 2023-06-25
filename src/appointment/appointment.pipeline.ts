import { PipelineStage } from 'mongoose';

export class AppointmentPipeline {
  static lookupDoctors(): PipelineStage[] {
    return this.lookupField({
      collectionName: 'doctors',
      localField: 'idDoctor',
      foreignField: 'id',
      as: 'doctor',
    });
  }

  static lookupPatients(): PipelineStage[] {
    return this.lookupField({
      collectionName: 'patients',
      localField: 'idPatient',
      foreignField: 'id',
      as: 'patient',
    });
  }

  private static lookupField({
    collectionName,
    localField,
    foreignField,
    as,
  }: lookupFieldType): PipelineStage[] {
    return [
      {
        $lookup: {
          from: collectionName,
          let: {
            field: '$' + localField,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$' + foreignField, '$$field'],
                },
              },
            },
            {
              $project: {
                _id: 0,
                __v: 0,
              },
            },
          ],
          as,
        },
      },
      {
        $project: {
          _id: 0,
          __v: 0,
        },
      },
      {
        $unwind: {
          path: '$' + as,
        },
      },
    ];
  }
}

type lookupFieldType = {
  collectionName: string;
  localField: string;
  foreignField: string;
  as: string;
};
