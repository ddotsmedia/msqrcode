import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../entities/product.entity';
import { BranchProductPrice } from '../entities/branch-product-price.entity';
import { IPaymentProvider } from '../payments/payment-provider.interface';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private orders: Repository<Order>,
    @InjectRepository(OrderItem) private items: Repository<OrderItem>,
    @InjectRepository(Product) private products: Repository<Product>,
    @InjectRepository(BranchProductPrice) private prices: Repository<BranchProductPrice>,
    @Inject('PaymentProvider') private paymentProvider: IPaymentProvider,
  ) {}

  async create(branchId: string, body: Record<string, unknown>): Promise<any> {
    const customerName = String(body.customer_name || '').trim();
    const phone = String(body.phone || '').trim();
    const type = body.type === 'dine_in' ? 'dine_in' : 'pickup';
    const tableNumber = type === 'dine_in' ? String(body.table_number || '').trim() || null : null;
    const cartItems = Array.isArray(body.items) ? body.items : [];

    if (!customerName || !phone) throw new BadRequestException('Customer name and phone are required');
    if (cartItems.length === 0) throw new BadRequestException('Cart cannot be empty');

    // Calculate total from database prices only
    let subtotal = 0;
    const orderItems: OrderItem[] = [];

    for (const item of cartItems) {
      const productId = String(item.product_id).trim();
      const qty = Number(item.qty);
      if (!productId || qty < 1) continue;

      const product = await this.products.findOne({ where: { id: productId } });
      if (!product) throw new NotFoundException(`Product ${productId} not found`);

      // Check for branch price override, fallback to base price
      const branchPrice = await this.prices.findOne({ where: { branch_id: branchId, product_id: productId } });
      const unitPrice = branchPrice ? Number(branchPrice.price_aed) : Number(product.base_price);

      subtotal += unitPrice * qty;
      orderItems.push(
        this.items.create({
          product_id: productId,
          name_snapshot: product.name,
          unit_price: unitPrice,
          qty,
          options: item.options ?? null,
        }),
      );
    }

    const accessToken = uuidv4();
    const order = this.orders.create({
      branch_id: branchId,
      order_no: new Date().toISOString().slice(0, 10) + '-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      customer_name: customerName,
      phone,
      type,
      table_number: tableNumber,
      subtotal,
      total: subtotal,
      status: 'placed',
      access_token: accessToken,
    });

    const savedOrder = await this.orders.save(order);
    orderItems.forEach((item) => (item.order_id = savedOrder.id));
    await this.items.save(orderItems);

    // Create checkout
    const checkout = await this.paymentProvider.createCheckout({
      id: savedOrder.id,
      branch_id: branchId,
      customer_name: customerName,
      phone,
      total: subtotal,
    });

    return {
      id: savedOrder.id,
      access_token: accessToken,
      order_no: savedOrder.order_no,
      redirect_url: checkout.redirect_url,
    };
  }

  async getById(id: string, accessToken?: string): Promise<any> {
    const order = await this.orders.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Order not found');
    if (accessToken && order.access_token !== accessToken) throw new BadRequestException('Invalid access token');
    return order;
  }

  async updateStatus(id: string, status: string): Promise<any> {
    const validStatuses = ['placed', 'paid', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) throw new BadRequestException('Invalid status');
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    order.status = status as any;
    return this.orders.save(order);
  }

  async listByBranch(branchId: string, limit = 50): Promise<any[]> {
    return this.orders.find({
      where: { branch_id: branchId },
      relations: ['items'],
      order: { created_at: 'DESC' },
      take: limit,
    });
  }
}
