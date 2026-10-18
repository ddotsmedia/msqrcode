import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RatingsService } from './ratings.service';

@Controller()
export class RatingsController {
  constructor(private ratings: RatingsService) {}

  @Get('ratings/loved')
  loved() {
    return this.ratings.loved();
  }

  @Post('orders/:id/rate')
  rate(@Param('id') id: string, @Body() body: { token?: unknown; product_id?: unknown; up?: unknown }) {
    return this.ratings.rate(id, body);
  }
}
