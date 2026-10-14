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

  @UpdateDateColumn()
  updated_at: Date;
}
