import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CorporateService } from './corporate.service';

@Controller()
export class CorporateController {
  constructor(private corp: CorporateService) {}

  @Post('corporate/apply')
  apply(@Body() body: Record<string, unknown>) {
    return this.corp.apply(body);
  }

  @Get('corporate/portal/:token')
  portal(@Param('token') token: string) {
    return this.corp.portal(token);
  }

  @Get('corporate/portal/:token/invoices/:id')
  portalInvoice(@Param('token') token: string, @Param('id') id: string) {
    return this.corp.portalInvoice(token, id);
  }

  @Get('admin/corporate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  list() {
    return this.corp.list();
  }

  @Patch('admin/corporate/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.corp.update(id, body);
  }

  @Post('admin/corporate/:id/invoices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  issue(@Param('id') id: string, @Body() body: { month?: unknown }) {
    return this.corp.issue(id, body?.month);
  }

  @Get('admin/corporate/:id/invoices/:invoiceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  invoice(@Param('id') id: string, @Param('invoiceId') invoiceId: string) {
    return this.corp.invoiceDetail(id, invoiceId);
  }

  @Post('admin/corporate/invoices/:invoiceId/paid')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  paid(@Param('invoiceId') invoiceId: string, @Body() body: { paid?: unknown }) {
    return this.corp.setPaid(invoiceId, body?.paid !== false);
  }
}
