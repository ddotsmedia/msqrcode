import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type JobRole = 'barista' | 'shift_lead' | 'kitchen' | 'cashier' | 'other';
export type JobStatus = 'new' | 'shortlisted' | 'closed';

// A job application sent from the public Careers page. The CV is stored in the row (small files only).
@Entity('job_applications')
@Index(['status', 'created_at'])
export class JobApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 12 })
  role: JobRole;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  email: string | null;

  @Column({ type: 'int', default: 0 })
  experience_years: number;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  cv_name: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  cv_type: string | null;

  // Not loaded in lists; fetched only when staff download it.
  @Column({ type: 'bytea', nullable: true, select: false })
  cv: Buffer | null;

  @Column({ type: 'varchar', length: 12, default: 'new' })
  status: JobStatus;

  @CreateDateColumn()
  created_at: Date;
}
