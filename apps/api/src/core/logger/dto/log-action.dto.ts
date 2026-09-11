import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { LogAction } from './log-action.enum';

export class LogQueryDto {
  @ApiProperty({ name: 'q', required: false, type: String })
  q?: string;

  @ApiProperty({ name: 'section', required: false, type: String })
  @IsOptional()
  section?: string;

  @ApiProperty({ name: 'action', required: false, enum: LogAction })
  @IsOptional()
  action?: string;

  @ApiProperty({ name: 'userId', required: false, type: String })
  userId?: string;

  @ApiProperty({
    name: 'from',
    required: false,
    type: String,
    description: 'ISO date',
  })
  @IsOptional()
  from?: string;

  @ApiProperty({
    name: 'to',
    required: false,
    type: String,
    description: 'ISO date',
  })
  @IsOptional()
  to?: string;

  @ApiProperty({ name: 'page', required: false, type: Number })
  page?: number;

  @ApiProperty({ name: 'limit', required: false, type: Number })
  limit?: number;
}

export class LogItemDto {
  // The list actually returns the entity's primary key `logId` — the DTO
  // used to declare `id`, which never existed on the wire.
  @ApiProperty({ type: String })
  logId: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string | Date;

  @ApiProperty({ type: String })
  section: string;

  @ApiProperty({ enum: LogAction })
  action: LogAction;

  @ApiProperty({ type: String, nullable: true })
  userId: string | null;

  @ApiProperty({ type: String, nullable: true })
  refType: string | null;

  @ApiProperty({ type: String, nullable: true })
  refId: string | null;

  @ApiProperty({ type: String, nullable: true })
  message?: string | null;

  @ApiProperty({
    description: 'JSON string or object',
    required: false,
    nullable: true,
  })
  data?: unknown;

  @ApiProperty({ type: Boolean, required: false })
  isSystem?: boolean;

  @ApiProperty({ type: String, nullable: true, required: false })
  ip?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false })
  device?: string | null;

  @ApiProperty({ type: Object, nullable: true })
  user: Record<string, unknown> | null;
}

export class LogFacetUserDto {
  @ApiProperty({ type: String, nullable: true })
  userId: string | null;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: Boolean })
  isSystem: boolean;
}

/** Filter facets of the redesign logbook (dropdowns + action chips). */
export class LogFacetsDto {
  @ApiProperty({ type: Number })
  total: number;

  @ApiProperty({ type: [String] })
  sections: string[];

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Entry count per LogAction',
  })
  actionCounts: Record<string, number>;

  @ApiProperty({ type: [LogFacetUserDto] })
  users: LogFacetUserDto[];
}

export class LogResponseDto {
  @ApiProperty({ type: [LogItemDto] })
  items: LogItemDto[];

  @ApiProperty({ type: Number })
  total: number;

  @ApiProperty({ type: Number })
  page: number;

  @ApiProperty({ type: Number })
  limit: number;
}
