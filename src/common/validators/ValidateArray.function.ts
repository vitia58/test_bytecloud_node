import { ClassConstructor, plainToClass } from 'class-transformer';
import { validate } from 'class-validator';

export const validateArray = async <T extends object>(
  array: any[],
  type: ClassConstructor<T>,
) => {
  const resultObject: {
    errors: {
      entity: T;
      error: string;
    }[];
    result: T[];
  } = { errors: [], result: [] };

  const validationLines = await Promise.all(
    array
      .map((entity) => plainToClass(type, entity))
      .map(async (entity) => ({
        entity,
        error: await validate(entity, {
          validationError: { target: true, value: true },
        }),
      })),
  );

  resultObject.errors = validationLines
    .filter(({ error }) => error && error.length > 0)
    .map(({ error, entity }) => ({
      entity,
      error: Object.values(error[0].constraints)[0],
    }));

  resultObject.result = validationLines
    .filter(({ error }) => error && error.length == 0)
    .map(({ entity }) => entity);

  return resultObject;
};

export const processValidate = async <T extends object>(
  validatedObject: Awaited<ReturnType<typeof validateArray<T>>>,
  processFunc: (entity: T) => any,
) => {
  const result: {
    errors: typeof validatedObject.errors;
    result: {
      entity: T;
      error: string;
    }[];
  } = { ...validatedObject, result: [] };

  for (const entity of validatedObject.result) {
    const resEntity = await processFunc(entity)
      .then((entity: T) => ({ entity }))
      .catch((error: Error) => ({
        entity: entity,
        error: error.message,
      }));
    result.result.push(resEntity);
  }
  return result;
};
