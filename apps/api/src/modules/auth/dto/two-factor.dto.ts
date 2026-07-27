import { IsString, Length } from 'class-validator';

export class VerifyTwoFactorSetupRequestDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class TwoFactorLoginRequestDto {
  @IsString()
  twoFactorToken!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
