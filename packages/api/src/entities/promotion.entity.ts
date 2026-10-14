import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

// branch_id null = offer applies to all branches. Dates are YYYY-MM-DD (Asia/Dubai).
@Entity('promotions')
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  body: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  starts_on: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  ends_on: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}
