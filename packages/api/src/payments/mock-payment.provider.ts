import { Request } from 'express';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IPaymentProvider, OrderForPayment, PaymentCheckout } from './payment-provider.interface';

@Injectable()
export class MockPaymentProvider implements IPaymentProvider {
  name = 'mock';

  async createCheckout(order: OrderForPayment): Promise<PaymentCheckout> {
    const paymentRef = `mock_${randomUUID()}`;
    const redirectUrl = `/order/${order.id}?payment_ref=${paymentRef}`;
    return { redirect_url: redirectUrl, payment_ref: paymentRef };
  }

  async verifyWebhook(req: Request): Promise<{ orderId: string; status: 'paid' | 'failed' }> {
    // Mock webhook always returns paid
    return { orderId: (req.body as any).order_id, status: 'paid' };
  }
}
