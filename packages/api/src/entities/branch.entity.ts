import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ProductAvailability } from './product-availability.entity';
import { BranchPricingOverride } from './branch-pricing-override.entity';
import { User } from './user.entity';
import { AnalyticsEvent } from './analytics-event.entity';

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 50, default: 'UTC' })
  timezone: string;

  @Column({ type: 'float', nullable: true })
  latitude: number;

  @Column({ type: 'float', nullable: true })
  longitude: number;

  @Column({ type: 'jsonb', nullable: true })
  operating_hours: Record<string, any>;

  @Column({ type: 'simple-array', nullable: true })
  holiday_dates: string[];

  @Column({ type: 'varchar', nullable: true })
  cover_image_url: string;

  @Column({ type: 'varchar', nullable: true })
  logo_image_url: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  google_maps_url: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  google_review_url: string | null;

  @Column({ type: 'jsonb', nullable: true })
  delivery_links: Record<string, string> | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  whatsapp_number: string | null;

  // Customers can order from the table QR menu (pay at the counter). Off until staff switch it on.
  @Column({ type: 'boolean', default: false })
  ordering_enabled: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ProductAvailability, (pa) => pa.branch)
  product_availabilities: ProductAvailability[];

  @OneToMany(() => BranchPricingOverride, (bpo) => bpo.branch)
  pricing_overrides: BranchPricingOverride[];

  @OneToMany(() => User, (user) => user.assigned_branch)
  users: User[];

  @OneToMany(() => AnalyticsEvent, (ae) => ae.branch)
  analytics_events: AnalyticsEvent[];
}
