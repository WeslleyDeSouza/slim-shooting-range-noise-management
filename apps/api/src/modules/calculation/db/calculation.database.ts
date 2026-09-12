import {
  AffectedAnalysisEntity,
  AreaCalculationEntity,
  AreaWlrEntity,
  BuildingEntity,
  CalculationRunEntity,
  HighScreenEntity,
  ImmissionCalculationEntity,
  ImmissionPointEntity,
  IsophoneEntity,
  MeasureAreaEntity,
  MeasureOperationalEntity,
  MeasurePointEntity,
  MeasureSsfEntity,
  ObstacleEntity,
  PlantPartEntity,
  PropagationEntity,
  ShootingHouseEntity,
  SourceDataA7Entity,
  SourceDataA9Entity,
  SourceLineEntity,
  StudyPerimeterEntity,
} from '../entities';

/**
 * Entities of this module: the Zustandsebene of B1 Kap. 10.2 (every
 * hellblau class of Abb. 43 / the FGDB object catalogue B1.2 11.4) plus the
 * Berechnungslauf. Spread into the TypeORM list in app.module.ts.
 */
const DBOptions = {
  entities: [
    ImmissionCalculationEntity,
    AreaCalculationEntity,
    PropagationEntity,
    StudyPerimeterEntity,
    PlantPartEntity,
    SourceLineEntity,
    SourceDataA9Entity,
    SourceDataA7Entity,
    BuildingEntity,
    ImmissionPointEntity,
    AreaWlrEntity,
    IsophoneEntity,
    AffectedAnalysisEntity,
    ObstacleEntity,
    HighScreenEntity,
    ShootingHouseEntity,
    MeasurePointEntity,
    MeasureAreaEntity,
    MeasureOperationalEntity,
    MeasureSsfEntity,
    CalculationRunEntity,
  ],
};

export default DBOptions;
