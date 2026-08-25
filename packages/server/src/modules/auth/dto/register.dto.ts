import { IsString, IsEmail, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: '用户名只能包含字母、数字和下划线',
  })
  username: string;

  @IsEmail({}, { message: '请输入合法的邮箱地址' })
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(32)
  password: string;
}
