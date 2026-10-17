import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Branch } from './branch.entity';
import { OrderItem } from './order-item.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ type: 'varchar', length: 50 })
  order_no: string;

  @Column({ type: 'varchar', length: 255 })
  customer_name: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 20, default: 'pickup' })
  type: 'pickup' | 'dine_in';

  @Column({ type: 'varchar', length: 20, nullable: true })
  table_number: string | null;

  // Pickup orders: when the customer will collect it.
  @Column({ type: 'timestamptz', nullable: true })
  pickup_at: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'placed' })
  status: 'placed' | 'paid' | 'preparing' | 'ready' | 'completed' | 'cancelled';

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  payment_status: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  payment_provider: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  payment_ref: string | null;

  @Column({ type: 'varchar', length: 255, unique: true })
  access_token: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];
}
