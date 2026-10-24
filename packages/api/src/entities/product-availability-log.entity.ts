import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// One row each time a product's sold-out state changes at a branch. Feeds sold-out history in menu analytics.
@Entity('product_availability_log')
@Index(['branch_id', 'product_id', 'created_at'])
export class ProductAvailabilityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  branch_id: string;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'boolean' })
  is_available: boolean;

  @Column({ type: 'varchar', nullable: true })
  changed_by_user_id: string | null;

  @CreateDateColumn()
  created_at: Date;
}
