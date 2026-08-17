import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { RegistrationService } from '../tenant/registration.service';
import { Tenant } from '../database/models/tenant.model';
import { Doctor } from '../database/models/doctor.model';
import { User } from '../database/models/user.model';
import { Role } from '../database/models/role.model';
import { Permission } from '../database/models/permission.model';
import { RolePermission } from '../database/models/role-permission.model';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('jwt').secret,
        signOptions: { expiresIn: config.get('jwt').expiresIn },
      }),
    }),
    SequelizeModule.forFeature([Tenant, Doctor, User, Role, Permission, RolePermission]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RegistrationService],
  exports: [AuthService],
})
export class AuthModule {}
