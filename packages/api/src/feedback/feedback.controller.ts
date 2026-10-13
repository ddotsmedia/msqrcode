import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FeedbackService } from './feedback.service';

@Controller()
export class FeedbackController {
  constructor(private feedback: FeedbackService) {}

  @Post('branches/:id/feedback')
  submit(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.feedback.submit(id, body);
  }

  @Get('admin/feedback')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  list(@Query('branch_id') branchId: string) {
    return this.feedback.listForBranch(branchId);
  }
}
