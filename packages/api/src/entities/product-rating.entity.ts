import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

// A customer's thumbs up/down for one item of an order they collected (one vote per item per order).
@Entity('product_ratings')
@Unique(['order_id', 'product_id'])
@Index(['product_id', 'created_at'])
export class ProductRating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  order_id: string;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'boolean' })
  up: boolean;

  @CreateDateColumn()
  created_at: Date;
}
