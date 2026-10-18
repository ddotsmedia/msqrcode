import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

// One digital coupon per offer per rewards card. The code is reissued (10 minutes each) until staff redeem it.
@Entity('coupon_redemptions')
@Unique(['promotion_id', 'card_id'])
@Index(['code'])
export class CouponRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  promotion_id: string;

  @Column({ type: 'uuid' })
  card_id: string;

  @Column({ type: 'varchar', length: 8 })
  code: string;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  redeemed_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  redeemed_branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  redeemed_by: string | null;

  @CreateDateColumn()
  created_at: Date;
}
