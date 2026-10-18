import { Controller, Post, Get, UseGuards, UploadedFile, UseInterceptors, Query, BadRequestException, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { MenuImportService } from './menu-import.service';
import { Response } from 'express';

@Controller('admin/menu')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class MenuImportController {
  constructor(private import_: MenuImportService) {}

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5_000_000 } }))
  async importMenu(
    @UploadedFile() file: any,
    @Query('dry_run') dryRun: string = 'true',
  ): Promise<any> {
    if (!file) throw new BadRequestException('File is required');
    if (file.size > 5_000_000) throw new BadRequestException('File must be less than 5 MB');
    return this.import_.import(file.buffer, file.originalname, dryRun !== 'false');
  }

  @Get('template.xlsx')
  async getTemplate(@Res() res: Response): Promise<void> {
    const buffer = await this.import_.template();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="menu-template.xlsx"',
    });
    res.send(buffer);
  }

  @Get('export.xlsx')
  async exportMenu(@Res() res: Response): Promise<void> {
    const buffer = await this.import_.export();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="menu-export.xlsx"',
    });
    res.send(buffer);
  }
}
