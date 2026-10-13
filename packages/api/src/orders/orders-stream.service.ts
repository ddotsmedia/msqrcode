import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface OrderUpdate {
  id: string;
  status: string;
  customer_name: string;
  order_no: string;
  branch_id: string;
  type: 'pickup' | 'dine_in';
  table_number?: string;
}

@Injectable()
export class OrdersStreamService {
  private orderUpdates = new Subject<OrderUpdate>();

  getOrderStream() {
    return this.orderUpdates.asObservable();
  }

  emitOrderUpdate(update: OrderUpdate) {
    this.orderUpdates.next(update);
  }
}
