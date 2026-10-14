import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type LoyaltyEventType = 'enroll' | 'stamp' | 'redeem' | 'adjust';

// One row per change to a loyalty card: the card's history and the staff audit log.
@Entity('loyalty_events')
@Index(['card_id', 'created_at'])
export class LoyaltyEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  card_id: string;

  @Column({ type: 'varchar', length: 16 })
  type: LoyaltyEventType;

  // Stamps added (+) or removed (-) by this event.
  @Column({ type: 'int', default: 0 })
  delta: number;

  @Column({ type: 'int' })
  stamps_after: number;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  staff_user_id: string | null;

  // Reason for a manual adjustment. Never shown to customers.
  @Column({ type: 'varchar', length: 200, nullable: true })
  note: string | null;

  @CreateDateColumn()
  created_at: Date;
}
