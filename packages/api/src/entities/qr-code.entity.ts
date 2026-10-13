import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Branch } from './branch.entity';

@Entity('qr_codes')
export class QrCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  branch_id: string;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ type: 'varchar', length: 10, default: 'branch' })
  kind: string; // branch | table

  @Column({ type: 'varchar', length: 20, nullable: true })
  table_number: string | null;

  @Column({ type: 'varchar', length: 120 })
  label: string;

  @Column({ type: 'varchar', length: 120, default: 'Scan to view the menu' })
  caption: string;

  @Column({ type: 'varchar', length: 7, default: '#111111' })
  foreground: string;

  @Column({ type: 'varchar', length: 7, default: '#ffffff' })
  background: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  artwork_name: string | null;

  // Base64 data URL of the saved menu poster. Excluded from normal queries so lists stay small.
  @Column({ type: 'text', nullable: true, select: false })
  artwork_data: string | null;

  @Column({ type: 'float', nullable: true })
  artwork_x: number | null;

  @Column({ type: 'float', nullable: true })
  artwork_y: number | null;

  @Column({ type: 'float', nullable: true })
  artwork_size: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
