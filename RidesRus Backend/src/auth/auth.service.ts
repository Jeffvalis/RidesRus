import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async registerPassenger(data: any) {
    const { name, phone, password } = data;
    const email = data.email || `${phone.replace(/\D/g, '')}@rider.local`;
    
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ email }, { phone }] }});
    if (existing) throw new BadRequestException('User already exists');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { name, email, phone, passwordHash }
    });

    const token = this.jwtService.sign({ sub: user.id, role: 'USER' });
    return { token, user: { id: user.id, name: user.name, email: user.email }};
  }

  async login(data: any, role: 'USER' | 'DRIVER' = 'USER') {
    const { emailOrPhone, password } = data;
    
    let account: any = null;
    if (role === 'USER') {
      account = await this.prisma.user.findFirst({ where: { OR: [{ email: emailOrPhone }, { phone: emailOrPhone }] }});
    } else {
      account = await this.prisma.driver.findFirst({ where: { phone: emailOrPhone }});
    }

    if (!account) throw new UnauthorizedException('Invalid credentials');
    
    const isMatch = await bcrypt.compare(password, account.passwordHash);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const token = this.jwtService.sign({ sub: account.id, role });
    return { token, account: { id: account.id, name: account.name, phone: account.phone }};
  }
}
