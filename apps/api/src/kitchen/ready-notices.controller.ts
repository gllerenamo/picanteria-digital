import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import type { ReadyNotice } from '@picanteria/shared';
import type { SessionContext } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { NOTICE_NOT_FOUND, UuidParamPipe } from './params';
import { ReadyNoticesService } from './ready-notices.service';

/** Avisos de plato listo del mozo (contracts/rest-api.yaml § Avisos al mozo). */
@Roles('WAITER')
@Controller('kitchen/ready-notices')
export class ReadyNoticesController {
  constructor(private readonly notices: ReadyNoticesService) {}

  @Get()
  list(@CurrentUser() auth: SessionContext): Promise<ReadyNotice[]> {
    return this.notices.listOpen(auth.user.id);
  }

  @Post(':noticeId/seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  markSeen(
    @Param('noticeId', new UuidParamPipe(NOTICE_NOT_FOUND)) noticeId: string,
    @CurrentUser() auth: SessionContext,
  ): Promise<void> {
    return this.notices.markSeen(noticeId, auth.user);
  }
}
