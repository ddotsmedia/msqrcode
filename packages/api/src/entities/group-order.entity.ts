import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// A shared pickup order: the host shares a link, everyone adds their own items, the host sends one order.
@Entity('group_orders')
export class GroupOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 8 })
  code: string;

  @Column({ type: 'uuid' })
  branch_id: string;

  @Column({ type: 'varchar', length: 60 })
  host_name: string;

  @Column({ type: 'varchar', length: 20 })
  host_phone: string;

  @Column({ type: 'varchar', length: 64, select: false })
  host_key: string;

  @Column({ type: 'varchar', length: 12, default: 'open' })
  status: string; // open | sent | cancelled

  @Column({ type: 'timestamptz' })
  closes_at: Date;

  @Column({ type: 'uuid', nullable: true })
  order_id: string | null;

  // Each person's items: [{ key, name, lines: [{ product_id, name, qty, unit, choices, labels, note }] }]. `unit` is for display only.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  members: GroupMember[];

  @CreateDateColumn()
  created_at: Date;
}

export interface GroupLine {
  product_id: string;
  name: string;
  qty: number;
  unit: number;
  choices: Record<string, string>;
  labels: string[];
  note: string;
}
export interface GroupMember {
  key: string;
  name: string;
  lines: GroupLine[];
  at: string;
}
