import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// A browser that agreed to get notifications for one rewards card.
@Entity('push_subscriptions')
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  card_id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 600 })
  endpoint: string;

  @Column({ type: 'varchar', length: 200 })
  p256dh: string;

  @Column({ type: 'varchar', length: 100 })
  auth: string;

  // Last "we miss you" message, so it is sent at most every 60 days.
  @Column({ type: 'timestamptz', nullable: true })
  winback_sent_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
