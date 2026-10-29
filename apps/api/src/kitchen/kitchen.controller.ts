import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  advanceItemSchema,
  undoItemSchema,
  type AdvanceItemRequest,
  type KitchenBoard,
  type TicketItem,
  type UndoItemRequest,
} from '@picanteria/shared';
import type { SessionContext } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { KitchenBoardService } from './kitchen-board.service';
import { KitchenItemsService } from './kitchen-items.service';
import { ITEM_NOT_FOUND, UuidParamPipe, VOID_NOT_FOUND } from './params';
import { VoidNoticesService } from './void-notices.service';

/** specs/004-cocina/contracts/rest-api.yaml (/kitchen). Solo cocina; ADMIN siempre pasa. */
@Roles('KITCHEN')
@Controller('kitchen')
export class KitchenController {
  constructor(
    private readonly board: KitchenBoardService,
    private readonly items: KitchenItemsService,
    private readonly voidNotices: VoidNoticesService,
  ) {}

  @Get('board')
  getBoard(): Promise<KitchenBoard> {
    return this.board.getBoard(new Date());
  }

  @Post('items/:itemId/advance')
  @HttpCode(HttpStatus.OK)
  advance(
    @Param('itemId', new UuidParamPipe(ITEM_NOT_FOUND)) itemId: string,
    @Body(new ZodValidationPipe(advanceItemSchema)) body: AdvanceItemRequest,
    @CurrentUser() auth: SessionContext,
  ): Promise<TicketItem> {
    return this.items.advance(itemId, body.from, auth.user);
  }

  @Post('items/:itemId/undo')
  @HttpCode(HttpStatus.OK)
  undo(
    @Param('itemId', new UuidParamPipe(ITEM_NOT_FOUND)) itemId: string,
    @Body(new ZodValidationPipe(undoItemSchema)) body: UndoItemRequest,
    @CurrentUser() auth: SessionContext,
  ): Promise<TicketItem> {
    return this.items.undo(itemId, body.from, auth.user);
  }

  @Post('void-notices/:itemVoidId/ack')
  @HttpCode(HttpStatus.NO_CONTENT)
  acknowledgeVoid(
    @Param('itemVoidId', new UuidParamPipe(VOID_NOT_FOUND)) itemVoidId: string,
    @CurrentUser() auth: SessionContext,
  ): Promise<void> {
    return this.voidNotices.acknowledge(itemVoidId, auth.user);
  }
}
