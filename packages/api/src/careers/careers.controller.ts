import { Body, Controller, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CareersService, CvFile, MAX_CV_BYTES } from './careers.service';

@Controller()
export class CareersController {
  constructor(private careers: CareersService) {}

  // Multipart form; the CV field is "cv". Files over the limit are cut off by multer, then refused.
  @Post('careers')
  @UseInterceptors(FileInterceptor('cv', { limits: { fileSize: MAX_CV_BYTES + 1, files: 1, fields: 20 } }))
  apply(@Body() body: Record<string, unknown>, @UploadedFile() file?: CvFile) {
    return this.careers.apply(body, file);
  }

  @Get('admin/careers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  list(@Query('status') status?: string) {
    return this.careers.list(status);
  }

  @Patch('admin/careers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  setStatus(@Param('id') id: string, @Body() body: { status?: unknown }) {
    return this.careers.setStatus(id, body?.status);
  }

  @Get('admin/careers/:id/cv')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async cv(@Param('id') id: string, @Res() res: any) {
    const f = await this.careers.cv(id);
    res.set({ 'Content-Type': f.type, 'Content-Disposition': `attachment; filename="${f.name}"`, 'X-Content-Type-Options': 'nosniff' });
    res.send(f.data);
  }
}
