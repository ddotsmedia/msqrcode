import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

// Single row (id = 1) holding the programme rules admins can change.
@Entity('loyalty_settings')
export class LoyaltySettings {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ type: 'int', default: 10 })
  stamps_target: number;

  @Column({ type: 'varchar', length: 80, default: 'Free drink' })
  reward_name: string;

  // Most stamps one card can get per day (Asia/Dubai).
  @Column({ type: 'int', default: 3 })
  daily_stamp_limit: number;

  // Bonus stamps given on the first visit in the customer's birthday week.
  @Column({ type: 'int', default: 1 })
  birthday_bonus: number;

  // Bonus stamps given to both friends after the new customer's first stamp.
  @Column({ type: 'int', default: 1 })
  referral_bonus: number;

  // Double-stamp hours: weekdays 0-6 (0 = Sunday, Asia/Dubai), comma separated. Empty = off.
  @Column({ type: 'varchar', length: 20, default: '' })
  double_days: string;

  @Column({ type: 'varchar', length: 5, default: '14:00' })
  double_from: string;

  @Column({ type: 'varchar', length: 5, default: '17:00' })
  double_to: string;

  // Customers can stamp their own card by scanning the rotating code on the counter screen.
  @Column({ type: 'boolean', default: false })
  self_stamp: boolean;

  @UpdateDateColumn()
  updated_at: Date;
}
