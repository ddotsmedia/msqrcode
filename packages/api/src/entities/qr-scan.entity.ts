import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// One row per QR scan (anonymous). kind: table | branch | feedback | promo | stamp.
@Entity('qr_scans')
@Index(['kind', 'created_at'])
export class QrScan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 12 })
  kind: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  table_number: string | null;

  @Column({ type: 'uuid', nullable: true })
  promotion_id: string | null;

  @CreateDateColumn()
  created_at: Date;
}
