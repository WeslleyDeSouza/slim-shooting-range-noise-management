import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import {
  BaseRuleValidator,
  getTenantFromReq,
  RuleContext,
  RuleValidationResult,
  RULES_KEY,
} from '@app-galaxy/core-api';
import { AreaScopeService } from './area-scope.service';

/** Name of the rule in the galaxy rule engine. */
export const AREA_SCOPE_RULE = 'area-scope';

/**
 * Class-level variant of galaxy's `@Rules([...])` (typed as a method
 * decorator): the RulesGuard reads the metadata from handler *and* class,
 * so one decorator on the controller covers every route with an area id.
 */
export const AreaScoped = (): ClassDecorator =>
  SetMetadata(RULES_KEY, { rules: [AREA_SCOPE_RULE] });

/**
 * galaxy rule (core-api RulesModule): a user whose roles are «W/R-O» may
 * only touch the Schiessplätze assigned to them. The area comes from the
 * route (`:areaId` of the usage / calculation controllers, `:id` of the
 * area controller); requests without an area id (lists) pass and are
 * filtered by `AreaScopeService.allowedAreaIds` in the service instead.
 */
@Injectable()
export class AreaScopeRule extends BaseRuleValidator {
  readonly name = AREA_SCOPE_RULE;

  constructor(private readonly scope: AreaScopeService) {
    super();
  }

  async validate(context: RuleContext): Promise<RuleValidationResult> {
    const areaId = String(context.params?.['areaId'] ?? context.params?.['id'] ?? '');
    const { userId, tenantId } = context.user;
    if (!areaId || !tenantId || !userId) return this.success();
    if (await this.scope.canAccess(tenantId, userId, areaId)) return this.success();
    return this.failure('Not assigned to this Schiessplatz', 'AREA_SCOPE');
  }
}

/**
 * The galaxy `RulesGuard` reads `request.tenantId`, the `TenantGuard` stores
 * the tenant as `request._tenant`. This guard bridges the two — put it right
 * before `RulesGuard` in `@UseGuards(...)`.
 */
@Injectable()
export class TenantIdOnRequestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!request.tenantId) request.tenantId = getTenantFromReq(request)?.tenantId;
    return true;
  }
}
