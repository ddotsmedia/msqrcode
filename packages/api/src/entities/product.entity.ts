import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { ProductVariant } from './product-variant.entity';
import { OptionGroup } from './option-group.entity';
import { ProductAvailability } from './product-availability.entity';
import { BranchPricingOverride } from './branch-pricing-override.entity';
import { AnalyticsEvent } from './analytics-event.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  sku: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'uuid' })
  category_id: string;

  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ type: 'uuid', nullable: true })
  subcategory_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  base_price: number;

  @Column({ type: 'varchar', nullable: true })
  image_url: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ type: 'int', default: 0 })
  display_order: number;

  @Column({ type: 'boolean', default: false })
  is_new: boolean;

  @Column({ type: 'boolean', default: false })
  is_popular: boolean;

  @Column({ type: 'boolean', default: false })
  is_seasonal: boolean;

  @Column({ type: 'jsonb', nullable: true })
  nutritional_info: Record<string, any>;

  @Column({ type: 'simple-array', nullable: true })
  dietary_tags: string[];

  @Column({ type: 'simple-array', nullable: true })
  allergens: string[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ProductVariant, (pv) => pv.product)
  variants: ProductVariant[];

  @OneToMany(() => OptionGroup, (og) => og.product)
  option_groups: OptionGroup[];

  @OneToMany(() => ProductAvailability, (pa) => pa.product)
  availabilities: ProductAvailability[];

  @OneToMany(() => BranchPricingOverride, (bpo) => bpo.product)
  pricing_overrides: BranchPricingOverride[];

  @OneToMany(() => AnalyticsEvent, (ae) => ae.product)
  analytics_events: AnalyticsEvent[];
}
