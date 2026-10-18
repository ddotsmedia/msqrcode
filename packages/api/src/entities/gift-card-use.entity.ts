import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// One spend from a gift card at the counter.
@Entity('gift_card_uses')
@Index(['card_id'])
export class GiftCardUse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  card_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  staff_id: string | null;

  @CreateDateColumn()
  created_at: Date;
}
