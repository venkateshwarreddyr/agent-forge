import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateRunDto {
  @IsString()
  @MinLength(10, { message: 'Requirements must be at least 10 characters' })
  @MaxLength(8000, { message: 'Requirements must not exceed 8000 characters' })
  requirements!: string;
}
