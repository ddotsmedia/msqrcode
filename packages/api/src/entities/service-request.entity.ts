import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type ServiceRequestType = 'staff' | 'bill';

// A customer at a table pressed "Call staff" or "Ask for the bill" on the menu.
@Entity('service_requests')
@Index(['branch_id', 'status'])
export class ServiceRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  branch_id: string;

  @Column({ type: 'varchar', length: 20 })
  table_number: string;

  @Column({ type: 'varchar', length: 10 })
  type: ServiceRequestType;

  // open until a staff member marks it done
  @Column({ type: 'varchar', length: 10, default: 'open' })
  status: 'open' | 'done';

  @Column({ type: 'uuid', nullable: true })
  done_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  done_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
