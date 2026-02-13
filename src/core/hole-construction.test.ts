import { describe, it, expect } from 'vitest';
import {
  inferHoleFeatureFromAssetId,
  createHoleFeatureAssignment,
  buildHoleDefinitionsFromAssets,
  syncHoleFeatureAssignments,
  calculateCoursePar,
  summarizeHoleGameplay,
  type PlaceableHoleAsset,
} from './hole-construction';

function makeAsset(
  assetId: string,
  x: number,
  z: number,
  feature?: ReturnType<typeof createHoleFeatureAssignment>
): PlaceableHoleAsset {
  return {
    assetId,
    x,
    y: 0,
    z,
    rotation: 0,
    gameplay: feature ? { holeFeature: feature } : undefined,
  };
}

describe('hole-construction', () => {
  describe('inferHoleFeatureFromAssetId', () => {
    it('infers tee markers', () => {
      expect(inferHoleFeatureFromAssetId('course.tee.marker.blue')).toEqual({
        kind: 'tee_box',
        teeSet: 'championship',
      });
    });

    it('infers pin assets', () => {
      expect(inferHoleFeatureFromAssetId('course.flag')).toEqual({
        kind: 'pin_position',
      });
      expect(inferHoleFeatureFromAssetId('course.cup')).toEqual({
        kind: 'pin_position',
      });
    });

    it('returns null for non-hole assets', () => {
      expect(inferHoleFeatureFromAssetId('tree.pine.medium')).toBeNull();
    });
  });

  describe('buildHoleDefinitionsFromAssets', () => {
    it('builds playable holes from explicit feature assignments', () => {
      const assets: PlaceableHoleAsset[] = [
        makeAsset('course.tee.marker.blue', 0, 0, createHoleFeatureAssignment('course.tee.marker.blue', 1)),
        makeAsset('course.tee.marker.white', 1, 0, createHoleFeatureAssignment('course.tee.marker.white', 1)),
        makeAsset('course.flag', 10, 0, createHoleFeatureAssignment('course.flag', 1)),
      ];

      const holes = buildHoleDefinitionsFromAssets(assets);
      expect(holes).toHaveLength(1);
      expect(holes[0].holeNumber).toBe(1);
      expect(holes[0].playable).toBe(true);
      expect(holes[0].teeBoxes).toHaveLength(2);
      expect(holes[0].pinPositions).toHaveLength(1);
      expect(Object.keys(holes[0].yardages)).toContain('Championship');
      expect(Object.keys(holes[0].yardages)).toContain('Middle');
    });

    it('assigns unassigned tees to nearest inferred pin hole', () => {
      const assets: PlaceableHoleAsset[] = [
        makeAsset('course.flag', 0, 0),
        makeAsset('course.flag', 20, 0),
        makeAsset('course.tee.marker.blue', 1, 0),
        makeAsset('course.tee.marker.red', 19, 0),
      ];

      const holes = buildHoleDefinitionsFromAssets(assets);
      expect(holes).toHaveLength(2);

      const hole1 = holes.find((hole) => hole.holeNumber === 1);
      const hole2 = holes.find((hole) => hole.holeNumber === 2);
      expect(hole1?.teeBoxes).toHaveLength(1);
      expect(hole2?.teeBoxes).toHaveLength(1);
      expect(hole1?.pinPositions).toHaveLength(1);
      expect(hole2?.pinPositions).toHaveLength(1);
      expect(hole1?.playable).toBe(true);
      expect(hole2?.playable).toBe(true);
    });

    it('marks hole as not playable when missing pin or tee', () => {
      const teeOnly: PlaceableHoleAsset[] = [
        makeAsset('course.tee.marker.blue', 0, 0, createHoleFeatureAssignment('course.tee.marker.blue', 1)),
      ];

      const holes = buildHoleDefinitionsFromAssets(teeOnly);
      expect(holes).toHaveLength(1);
      expect(holes[0].playable).toBe(false);
      expect(holes[0].validationIssues).toContain('Hole requires at least one pin position.');
    });
  });

  describe('syncHoleFeatureAssignments', () => {
    it('writes inferred hole assignment metadata back to assets', () => {
      const assets: PlaceableHoleAsset[] = [
        makeAsset('course.flag', 5, 5),
        makeAsset('course.tee.marker.white', 1, 1),
      ];

      const synced = syncHoleFeatureAssignments(assets);
      expect(synced[0].gameplay?.holeFeature).toBeDefined();
      expect(synced[1].gameplay?.holeFeature).toBeDefined();
      expect(synced[0].gameplay?.holeFeature?.holeNumber).toBe(1);
      expect(synced[1].gameplay?.holeFeature?.holeNumber).toBe(1);
    });
  });

  describe('course summaries', () => {
    it('calculates course par from hole yardages', () => {
      const holes = buildHoleDefinitionsFromAssets([
        makeAsset('course.tee.marker.blue', 0, 0, createHoleFeatureAssignment('course.tee.marker.blue', 1)),
        makeAsset('course.flag', 12, 0, createHoleFeatureAssignment('course.flag', 1)), // ~120y => par 3
        makeAsset('course.tee.marker.blue', 0, 10, createHoleFeatureAssignment('course.tee.marker.blue', 2)),
        makeAsset('course.flag', 38, 10, createHoleFeatureAssignment('course.flag', 2)), // ~380y => par 4
        makeAsset('course.tee.marker.blue', 0, 20, createHoleFeatureAssignment('course.tee.marker.blue', 3)),
        makeAsset('course.flag', 54, 20, createHoleFeatureAssignment('course.flag', 3)), // ~540y => par 5
      ]);

      expect(calculateCoursePar(holes)).toBe(12);
    });

    it('produces playable summary totals', () => {
      const holes = buildHoleDefinitionsFromAssets([
        makeAsset('course.tee.marker.white', 0, 0, createHoleFeatureAssignment('course.tee.marker.white', 1)),
        makeAsset('course.flag', 20, 0, createHoleFeatureAssignment('course.flag', 1)),
        makeAsset('course.tee.marker.white', 0, 10, createHoleFeatureAssignment('course.tee.marker.white', 2)),
      ]);

      const summary = summarizeHoleGameplay(holes);
      expect(summary.totalHoles).toBe(2);
      expect(summary.playableHoles).toBe(1);
      expect(summary.totalTeeBoxes).toBe(2);
      expect(summary.totalPinPositions).toBe(1);
    });
  });
});
