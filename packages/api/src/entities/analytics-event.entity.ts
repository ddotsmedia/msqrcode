import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Branch } from './branch.entity';
import { Product } from './product.entity';

@Entity('analytics_events')
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  event_type: string; // page_view, product_view, search, product_selected, feedback

  @Column({ type: 'uuid', nullable: true })
  branch_id: string;

  @ManyToOne(() => Branch, (branch) => branch.analytics_events, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ type: 'uuid', nullable: true })
  product_id: string;

  @ManyToOne(() => Product, (product) => product.analytics_events, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'text', nullable: true })
  search_query: string;

  @Column({ type: 'text', nullable: true })
  feedback_text: string;

  @Column({ type: 'int', nullable: true })
  feedback_rating: number;

  @Column({ type: 'text', nullable: true })
  user_agent: string;

  @CreateDateColumn()
  created_at: Date;
}
