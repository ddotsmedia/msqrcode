import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type CateringKind = 'office' | 'event' | 'cart' | 'other';
export type CateringStatus = 'new' | 'contacted' | 'closed';

// A catering / coffee-cart enquiry sent from the public Catering page.
@Entity('catering_requests')
@Index(['status', 'created_at'])
export class CateringRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10 })
  kind: CateringKind;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  company: string | null;

  // YYYY-MM-DD (Dubai)
  @Column({ type: 'varchar', length: 10 })
  event_date: string;

  @Column({ type: 'int' })
  guests: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  location: string | null;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 10, default: 'new' })
  status: CateringStatus;

  @CreateDateColumn()
  created_at: Date;
}
