import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// A gift card: requested online (paid at a branch to activate) or sold at the counter. Spent in parts until the balance is 0.
@Entity('gift_cards')
export class GiftCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 12 })
  code: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balance: string;

  @Column({ type: 'varchar', length: 12, default: 'pending' })
  status: string; // pending (not paid yet) | active | used | cancelled

  @Column({ type: 'varchar', length: 20, default: 'classic' })
  design: string; // classic | birthday | eid | thanks

  @Column({ type: 'varchar', length: 60 })
  buyer_name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  buyer_phone: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  recipient_name: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  message: string | null;

  @Column({ type: 'date', nullable: true })
  expires_on: string | null;

  @Column({ type: 'uuid', nullable: true })
  sold_branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  activated_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  activated_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
