import { Entity, PrimaryColumn, Column } from 'typeorm';

// One row (id = 1): Ramadan mode for the public site. When on and today is within the dates,
// branches show their Ramadan hours and the site shows the greeting and the Iftar & Suhoor picks.
@Entity('season_settings')
export class SeasonSettings {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ type: 'boolean', default: false })
  ramadan_enabled: boolean;

  // YYYY-MM-DD (Dubai), both inclusive
  @Column({ type: 'varchar', length: 10, nullable: true })
  ramadan_starts_on: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  ramadan_ends_on: string | null;

  @Column({ type: 'varchar', length: 120, default: 'Ramadan Kareem' })
  greeting: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  note: string | null;

  // Categories shown as "Iftar & Suhoor" picks (empty = none).
  @Column({ type: 'simple-array', nullable: true })
  featured_category_ids: string[] | null;
}
