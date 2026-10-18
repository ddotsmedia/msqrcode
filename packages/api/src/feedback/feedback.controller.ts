import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
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
  list(@Query('branch_id') branchId: string, @Req() req: { user: { role: string; assigned_branch_id?: string | null } }) {
    if (req.user.role !== 'admin' && req.user.assigned_branch_id !== branchId) throw new ForbiddenException('You can only see your own branch');
    return this.feedback.listForBranch(branchId);
  }
}
