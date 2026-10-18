import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index } from 'typeorm';

// A phone running the Milestones app (customer or staff), for native push through Firebase Cloud Messaging.
@Entity('device_tokens')
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 512 })
  token: string;

  @Column({ type: 'varchar', length: 10 })
  platform: string; // ios | android

  @Column({ type: 'varchar', length: 10, default: 'customer' })
  app: string; // customer | staff

  @Index()
  @Column({ type: 'uuid', nullable: true })
  card_id: string | null; // customer app: the rewards card on that phone

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null; // staff app: who signed in

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null; // staff app: their branch (null = full admin, all branches)

  @UpdateDateColumn()
  updated_at: Date;
}
