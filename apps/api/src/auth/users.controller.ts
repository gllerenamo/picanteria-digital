import { Body, Controller, Get, HttpCode, HttpStatus, Injectable, Param, Patch, type PipeTransform, Post, Put } from '@nestjs/common';
import {
  createUserRequestSchema,
  setPasswordRequestSchema,
  setStatusRequestSchema,
  updateUserRequestSchema,
  type CreateUserRequest,
  type SetPasswordRequest,
  type SetStatusRequest,
  type UpdateUserRequest,
  type User as UserDto,
} from '@picanteria/shared';
import { z } from 'zod';
import { AppException } from '../common/app.exception';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { SessionContext } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { UsersService } from './users.service';

const uuidSchema = z.string().uuid();

/** Un ID con formato inválido se trata igual que un usuario inexistente. */
@Injectable()
class UserIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!uuidSchema.safeParse(value).success) {
      throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: 'El usuario no existe' });
    }
    return value;
  }
}

/** Gestión de usuarios: exclusiva del administrador (contracts/rest-api.yaml § users). */
@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(): Promise<UserDto[]> {
    return this.users.list();
  }

  @Post()
  create(@Body(new ZodValidationPipe(createUserRequestSchema)) body: CreateUserRequest): Promise<UserDto> {
    return this.users.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', UserIdPipe) id: string,
    @Body(new ZodValidationPipe(updateUserRequestSchema)) body: UpdateUserRequest,
  ): Promise<UserDto> {
    return this.users.update(id, body);
  }

  @Put(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  setPassword(
    @Param('id', UserIdPipe) id: string,
    @Body(new ZodValidationPipe(setPasswordRequestSchema)) body: SetPasswordRequest,
  ): Promise<void> {
    return this.users.setPassword(id, body.password);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id', UserIdPipe) id: string,
    @Body(new ZodValidationPipe(setStatusRequestSchema)) body: SetStatusRequest,
    @CurrentUser() auth: SessionContext,
  ): Promise<UserDto> {
    return this.users.setStatus(auth.user.id, id, body.isActive);
  }
}
