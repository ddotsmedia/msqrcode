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

  // Happy hour: optional % off, live on these weekdays ('0' = Sunday) between these Dubai times.
  @Column({ type: 'int', nullable: true })
  discount_percent: number | null;

  // Only these categories (empty = whole menu).
  @Column({ type: 'simple-array', nullable: true })
  category_ids: string[] | null;

  @Column({ type: 'simple-array', nullable: true })
  days: string[] | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  start_time: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  end_time: string | null;

  // Offers page visuals: banner image (https), a code to show at the counter, and pinned to the top slider.
  @Column({ type: 'varchar', length: 500, nullable: true })
  image_url: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  promo_code: string | null;

  @Column({ type: 'boolean', default: false })
  featured: boolean;

  // Occasion look on the Offers page: national_day, ramadan, eid, new_year (null = normal).
  @Column({ type: 'varchar', length: 20, nullable: true })
  theme: string | null;

  // Combo deal: these 2–4 products together for combo_price (AED).
  @Column({ type: 'simple-array', nullable: true })
  combo_product_ids: string[] | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  combo_price: number | null;

  // Redeemed with a digital coupon at the counter, once per rewards card.
  @Column({ type: 'boolean', default: false })
  coupon_enabled: boolean;

  @CreateDateColumn()
  created_at: Date;
}
