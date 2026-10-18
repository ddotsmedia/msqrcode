import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

// Small key/value store for values the server creates itself (e.g. the push signing keys).
@Entity('app_secrets')
export class AppSecret {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
