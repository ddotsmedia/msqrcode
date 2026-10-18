import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// A monthly tax invoice for one company: all its on-account orders not billed yet, up to the end of that month.
@Entity('corporate_invoices')
@Index(['account_id'])
export class CorporateInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  account_id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  number: string; // MSQ-2026-0001

  @Column({ type: 'varchar', length: 7 })
  month: string; // YYYY-MM

  @Column({ type: 'int' })
  order_count: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: string; // VAT included

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  vat: string;

  @Column({ type: 'varchar', length: 10, default: 'unpaid' })
  status: string; // unpaid | paid

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date | null;

  @CreateDateColumn()
  issued_at: Date;
}
