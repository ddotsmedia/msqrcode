import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// A company that orders on account and pays by monthly tax invoice.
@Entity('corporate_accounts')
export class CorporateAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  company: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  trn: string | null; // UAE Tax Registration Number, 15 digits

  @Column({ type: 'varchar', length: 60 })
  contact_name: string;

  @Column({ type: 'varchar', length: 120 })
  email: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  address: string | null;

  @Column({ type: 'int', nullable: true })
  team_size: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  status: string; // pending | active | paused | rejected

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 2000 })
  credit_limit: string;

  // Secret link for the company's portal and for ordering on account. Set when first approved.
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, nullable: true })
  access_token: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
