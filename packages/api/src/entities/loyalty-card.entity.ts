import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('loyalty_cards')
export class LoyaltyCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  phone: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 64, unique: true })
  token: string;

  @Column({ type: 'int', default: 0 })
  stamps: number;

  @Column({ type: 'int', default: 0 })
  redeemed_count: number;

  // Birthday as MM-DD only; the year is never stored.
  @Column({ type: 'varchar', length: 5, nullable: true })
  birthday: string | null;

  // Year the birthday bonus was last given, so it is given once a year.
  @Column({ type: 'int', nullable: true })
  birthday_rewarded_year: number | null;

  // Code this customer shares with friends.
  @Column({ type: 'varchar', length: 12, nullable: true, unique: true })
  referral_code: string | null;

  // Card of the friend who referred this customer.
  @Column({ type: 'uuid', nullable: true })
  referred_by: string | null;

  // True once the referral bonus has been settled (given or not), so it never repeats.
  @Column({ type: 'boolean', default: false })
  referral_rewarded: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
