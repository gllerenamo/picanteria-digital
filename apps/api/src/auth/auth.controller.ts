import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { loginRequestSchema, type CurrentUser as CurrentUserDto, type LoginRequest } from '@picanteria/shared';
import type { CookieOptions, Request, Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ENV, type Env } from '../config/env';
import { AuthService, toCurrentUser } from './auth.service';
import type { SessionContext } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { SESSION_COOKIE, SESSION_TTL_MS } from './sessions.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private cookieOptions(): CookieOptions {
    return { httpOnly: true, sameSite: 'strict', secure: this.env.COOKIE_SECURE, path: '/' };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUserDto> {
    const { token, user } = await this.auth.login(body, request.get('user-agent'));
    response.cookie(SESSION_COOKIE, token, { ...this.cookieOptions(), maxAge: SESSION_TTL_MS });
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() auth: SessionContext, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.logout(auth.sessionId);
    response.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }

  @Get('me')
  me(@CurrentUser() auth: SessionContext): CurrentUserDto {
    return toCurrentUser(auth.user);
  }
}
