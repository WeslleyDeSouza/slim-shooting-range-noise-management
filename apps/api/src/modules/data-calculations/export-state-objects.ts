import { DataSource } from 'typeorm';
import {
  AffectedAnalysisEntity, BuildingEntity, HighScreenEntity, IsophoneEntity,
  MeasureAreaEntity, MeasureOperationalEntity, MeasurePointEntity, MeasureSsfEntity,
  ObstacleEntity, PropagationEntity, ShootingHouseEntity, StudyPerimeterEntity,
} from '../calculation/entities';
import { PlantPartObjectEntity } from '../calculation/entities/obstacles.entity';
import { StateExportModel } from './calculation-files.service';

/** All additional objects accepted by the state import, with external keys instead of database ids. */
export async function exportStateObjects(db: DataSource, tenantId: string, zustandId: string): Promise<StateExportModel['objects']> {
  const where = { tenantId, zustandId };
  const [propagation, perimeter, buildings, isophones, affectedAnalysis, obstacles, highScreens, shootingHouses, measuresPoint, measuresArea, measuresOperational, measuresSsf] = await Promise.all([
    db.getRepository(PropagationEntity).findOneBy(where),
    db.getRepository(StudyPerimeterEntity).findOneBy(where),
    db.getRepository(BuildingEntity).findBy(where),
    db.getRepository(IsophoneEntity).findBy(where),
    db.getRepository(AffectedAnalysisEntity).findOneBy(where),
    db.getRepository(ObstacleEntity).findBy(where),
    db.getRepository(HighScreenEntity).findBy(where),
    db.getRepository(ShootingHouseEntity).findBy(where),
    db.getRepository(MeasurePointEntity).findBy(where),
    db.getRepository(MeasureAreaEntity).findBy(where),
    db.getRepository(MeasureOperationalEntity).findBy(where),
    db.getRepository(MeasureSsfEntity).findBy(where),
  ]);
  const part = (o: PlantPartObjectEntity) => ({ coordinationSectionNo: o.coordinationSectionNo, geometry: o.geometry });
  return {
    propagation: propagation && {
      model: propagation.model, modelVersion: propagation.modelVersion, heightModel: propagation.heightModel,
      buildingDataset: propagation.buildingDataset, meteoIncluded: Boolean(propagation.meteoIncluded),
      meteoCount: propagation.meteoCount, meteoData: propagation.meteoData,
      reflectionIncluded: Boolean(propagation.reflectionIncluded), forestIncluded: Boolean(propagation.forestIncluded),
      primarySurfaces: propagation.primarySurfaces, remark: propagation.remark,
    },
    perimeter: perimeter && {
      name: perimeter.name, spmNo: perimeter.spmNo, coordinationSectionNo: perimeter.coordinationSectionNo, geometry: perimeter.geometry,
    },
    buildings: buildings.map(b => ({ egid: b.egid, address: b.address, surfaceType: b.surfaceType,
      assessment: b.assessment, persons: b.persons, remark: b.remark, geometry: b.geometry })),
    isophones: isophones.map(i => ({ lr: i.lr, height: i.height, resolution: i.resolution, remark: i.remark, geometry: i.geometry })),
    affectedAnalysis: affectedAnalysis && {
      personsPwIgw: affectedAnalysis.personsPwIgw, personsIgwAw: affectedAnalysis.personsIgwAw,
      personsAw: affectedAnalysis.personsAw, year: affectedAnalysis.year, remark: affectedAnalysis.remark,
      spmNo: affectedAnalysis.spmNo, persons55: affectedAnalysis.persons55, persons60: affectedAnalysis.persons60,
    },
    obstacles: obstacles.map(o => ({ ...part(o), measureType: o.obstacleType, surfaceType: o.surfaceType, remark: o.remark })),
    highScreens: highScreens.map(o => ({ ...part(o), bottomHeight: o.bottomHeight, surfaceType: o.surfaceType, remark: o.remark })),
    shootingHouses: shootingHouses.map(o => ({ ...part(o), remark: o.remark, attributes: {
      houseHeight: o.houseHeight, houseDepth: o.houseDepth, ridgeDistance: o.ridgeDistance, ridgeHeight: o.ridgeHeight,
      leftScreenLength: o.leftScreenLength, leftScreenHeight: o.leftScreenHeight,
      rightScreenLength: o.rightScreenLength, rightScreenHeight: o.rightScreenHeight,
      houseMaterial: o.houseMaterial, leftScreenMaterial: o.leftScreenMaterial, rightScreenMaterial: o.rightScreenMaterial,
    } })),
    measuresPoint: measuresPoint.map(o => ({ ...part(o), measureType: o.measureType, remark: o.remark })),
    measuresArea: measuresArea.map(o => ({ ...part(o), measureType: o.measureType, remark: o.remark, attributes: {
      width: o.width, length: o.length, height: o.height, spacingAcross: o.spacingAcross, spacingAlong: o.spacingAlong, depth: o.depth,
    } })),
    measuresOperational: measuresOperational.map(o => ({ ...part(o), measureType: o.measureType })),
    measuresSsf: measuresSsf.map(o => ({ egid: o.egid, coordinationSectionNo: o.coordinationSectionNo, measureType: o.measureType })),
  };
}
