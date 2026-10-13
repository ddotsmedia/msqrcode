import { Request } from 'express';

export interface OrderForPayment {
  id: string;
  branch_id: string;
  customer_name: string;
  phone: string;
  total: number;
}

export interface PaymentCheckout {
  redirect_url: string;
  payment_ref: string;
}

export interface IPaymentProvider {
  name: string;
  createCheckout(order: OrderForPayment): Promise<PaymentCheckout>;
  verifyWebhook(req: Request): Promise<{ orderId: string; status: 'paid' | 'failed' }>;
}
