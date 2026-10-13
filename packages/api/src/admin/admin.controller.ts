import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('categories')
  categories() {
    return this.admin.listCategories();
  }

  @Post('categories')
  createCategory(@Body() body: Record<string, unknown>) {
    return this.admin.saveCategory(null, body);
  }

  @Put('categories/:id')
  updateCategory(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.admin.saveCategory(id, body);
  }

  @Delete('categories/:id')
  archiveCategory(@Param('id') id: string) {
    return this.admin.archiveCategory(id);
  }

  @Get('products')
  products() {
    return this.admin.listProducts();
  }

  @Post('products')
  createProduct(@Body() body: Record<string, unknown>) {
    return this.admin.saveProduct(null, body);
  }

  @Put('products/:id')
  updateProduct(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.admin.saveProduct(id, body);
  }

  @Delete('products/:id')
  archiveProduct(@Param('id') id: string) {
    return this.admin.archiveProduct(id);
  }

  @Post('products/:id/variants')
  addVariant(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.admin.addVariant(id, body);
  }

  @Put('products/:id/variants/:variantId')
  updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.admin.updateVariant(id, variantId, body);
  }

  @Delete('products/:id/variants/:variantId')
  removeVariant(@Param('id') id: string, @Param('variantId') variantId: string) {
    return this.admin.removeVariant(id, variantId);
  }

  @Post('products/:id/option-groups')
  addOptionGroup(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.admin.addOptionGroup(id, body);
  }

  @Put('products/:id/option-groups/:groupId')
  updateOptionGroup(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.admin.updateOptionGroup(id, groupId, body);
  }

  @Delete('products/:id/option-groups/:groupId')
  removeOptionGroup(@Param('id') id: string, @Param('groupId') groupId: string) {
    return this.admin.removeOptionGroup(id, groupId);
  }
}
