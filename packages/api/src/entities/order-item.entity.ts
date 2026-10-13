import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';
import { Product } from './product.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  order_id: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'uuid' })
  product_id: string;

  @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product | null;

  @Column({ type: 'varchar', length: 255 })
  name_snapshot: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price: number;

  @Column({ type: 'int' })
  qty: number;

  @Column({ type: 'jsonb', nullable: true })
  options: Record<string, unknown> | null;
}
