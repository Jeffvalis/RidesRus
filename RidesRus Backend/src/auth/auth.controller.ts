import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('passenger/register')
  registerPassenger(@Body() body: any) {
    return this.authService.registerPassenger(body);
  }

  @Post('passenger/login')
  loginPassenger(@Body() body: any) {
    return this.authService.login(body, 'USER');
  }

  @Post('driver/login')
  loginDriver(@Body() body: any) {
    return this.authService.login(body, 'DRIVER');
  }
}
