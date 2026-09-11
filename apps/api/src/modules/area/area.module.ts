import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RuleEngineService, RulesModule } from '@app-galaxy/core-api';
import { AreaService } from './area.service';
import { AdminAreaController } from './controllers/admin-area.controller';
import DBOptions from './db/area.database';
import { AreaScopeRule, TenantIdOnRequestGuard } from './scope/area-scope.rule';
import { AreaScopeService } from './scope/area-scope.service';

@Module({
  imports: [TypeOrmModule.forFeature(DBOptions.entities), RulesModule],
  controllers: [AdminAreaController],
  providers: [AreaService, AreaScopeService, AreaScopeRule, TenantIdOnRequestGuard],
  exports: [AreaService, AreaScopeService, TenantIdOnRequestGuard, RulesModule],
})
export class AreaModule implements OnModuleInit {
  static DBOptions = DBOptions;

  constructor(
    private readonly ruleEngine: RuleEngineService,
    private readonly areaScope: AreaScopeRule,
  ) {}

  /** Registers the «W/R-O» rule with the galaxy rule engine (RulesGuard). */
  onModuleInit(): void {
    if (!this.ruleEngine.getRuleByName(this.areaScope.name)) {
      this.ruleEngine.addRule(this.areaScope);
    }
  }
}
