import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

// "Remind me": a rewards card asked for a phone notification shortly before this happy hour starts.
@Entity('offer_reminders')
@Unique(['promotion_id', 'card_id'])
export class OfferReminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  promotion_id: string;

  @Column({ type: 'uuid' })
  card_id: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_sent_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
