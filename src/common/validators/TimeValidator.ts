import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'timevalidator', async: false })
export class TimeValidator implements ValidatorConstraintInterface {
  validate(time: { from: number; to: number }, args: ValidationArguments) {
    if (!(args.object as any).time) return false;
    return (
      [time.from, time.to].every((time) => time < 24 && time > 0) &&
      time.from < time.to
    );
  }
}
