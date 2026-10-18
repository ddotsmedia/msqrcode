import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// What visitors do with an offer on the Offers page (anonymous counts only).
@Entity('offer_events')
@Index(['promotion_id', 'created_at'])
export class OfferEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  promotion_id: string;

  // view | code_copy | share | calendar | order_click | coupon_open | combo_add
  @Column({ type: 'varchar', length: 20 })
  type: string;

  @CreateDateColumn()
  created_at: Date;
}
