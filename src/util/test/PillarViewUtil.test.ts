import { BrowserClipInfo } from 'backend/type/BrowserClipInfo';
import { BrowserClipInfoList } from 'backend/type/BrowserClipInfoList';
import { ClipTypes } from 'backend/type/ClipTypes';
import { PillarViewUtil } from '~/util/PillarViewUtil';

const clipFixture = (
  pillar: number,
  clipName: string,
  type: ClipTypes,
  rfid?: string,
): BrowserClipInfo =>
  ({
    pillar,
    clipName,
    type,
    assetName: `${type}.png`,
    rfid,
    // The real type requires `rfid: string`, but derivePillars defensively
    // falls back to clipName when it's absent (`queued?.rfid ?? queued.clipName`)
    // - cast so this fixture can represent that real, if type-unsafe, case.
  } as unknown as BrowserClipInfo);

// A malformed event mid-show: a clip entry with no `type` at all (the guard
// PillarViewUtil.derivePillars protects against).
const typelessClip = (pillar: number, clipName: string): BrowserClipInfo =>
  ({ pillar, clipName, assetName: 'x.png' } as unknown as BrowserClipInfo);

const EMPTY_LIST: BrowserClipInfoList = [null, null, null, null];
const NO_VOLUME = [0, 0, 0, 0];

describe('PillarViewUtil.derivePillars', () => {
  it('always returns exactly 4 pillars, numbered 1 through 4', () => {
    const pillars = PillarViewUtil.derivePillars(EMPTY_LIST, EMPTY_LIST, EMPTY_LIST, NO_VOLUME);
    expect(pillars).toHaveLength(4);
    expect(pillars.map((p) => p.pillarNumber)).toEqual([1, 2, 3, 4]);
  });

  it('renders empty status with no category and no queued rows when a pillar has no clips', () => {
    const pillars = PillarViewUtil.derivePillars(EMPTY_LIST, EMPTY_LIST, EMPTY_LIST, NO_VOLUME);
    expect(pillars[0]).toMatchObject({ status: 'empty', queued: [] });
    expect(pillars[0].category).toBeUndefined();
  });

  describe('status precedence', () => {
    it('prefers playing over stopping and queued', () => {
      const playing: BrowserClipInfoList = [
        clipFixture(0, 'Vocal Hook', ClipTypes.Vox, 'r1'),
        null,
        null,
        null,
      ];
      const stopping: BrowserClipInfoList = [
        clipFixture(0, 'Old Vocal', ClipTypes.Melody, 'r2'),
        null,
        null,
        null,
      ];
      const queued: BrowserClipInfoList = [
        clipFixture(0, 'Next Vocal', ClipTypes.Bass, 'r3'),
        null,
        null,
        null,
      ];

      const [pillar] = PillarViewUtil.derivePillars(playing, queued, stopping, NO_VOLUME);

      expect(pillar.status).toBe('playing');
      expect(pillar.category).toBe(ClipTypes.Vox);
    });

    it('renders stopping as the dimmed paused status when nothing is playing', () => {
      const stopping: BrowserClipInfoList = [
        clipFixture(0, 'Winding Down', ClipTypes.Drums, 'r1'),
        null,
        null,
        null,
      ];
      const queued: BrowserClipInfoList = [
        clipFixture(0, 'Next Up', ClipTypes.Bass, 'r2'),
        null,
        null,
        null,
      ];

      const [pillar] = PillarViewUtil.derivePillars(EMPTY_LIST, queued, stopping, NO_VOLUME);

      expect(pillar.status).toBe('paused');
      expect(pillar.category).toBe(ClipTypes.Drums);
    });

    it('falls back to queued when nothing is playing or stopping', () => {
      const queued: BrowserClipInfoList = [
        clipFixture(0, 'Waiting', ClipTypes.Melody, 'r1'),
        null,
        null,
        null,
      ];

      const [pillar] = PillarViewUtil.derivePillars(EMPTY_LIST, queued, EMPTY_LIST, NO_VOLUME);

      expect(pillar.status).toBe('queued');
      expect(pillar.category).toBe(ClipTypes.Melody);
    });

    it('is empty when there is no playing, stopping, or queued clip', () => {
      const [pillar] = PillarViewUtil.derivePillars(EMPTY_LIST, EMPTY_LIST, EMPTY_LIST, NO_VOLUME);
      expect(pillar.status).toBe('empty');
    });
  });

  it('treats a clip missing `type` as empty (malformed-event guard)', () => {
    const playing: BrowserClipInfoList = [typelessClip(0, 'Broken Event'), null, null, null];
    const [pillar] = PillarViewUtil.derivePillars(playing, EMPTY_LIST, EMPTY_LIST, NO_VOLUME);
    expect(pillar.status).toBe('empty');
    expect(pillar.category).toBeUndefined();
    expect(pillar.queued).toEqual([]);
  });

  describe('volumePercent', () => {
    it('rounds a mid-range volume relative to the 0.7 max', () => {
      const pillars = PillarViewUtil.derivePillars(
        EMPTY_LIST,
        EMPTY_LIST,
        EMPTY_LIST,
        [0.35, 0, 0, 0],
      );
      expect(pillars[0].volumePercent).toBe(50);
    });

    it('reads 0.7 as 100%', () => {
      const pillars = PillarViewUtil.derivePillars(
        EMPTY_LIST,
        EMPTY_LIST,
        EMPTY_LIST,
        [0.7, 0, 0, 0],
      );
      expect(pillars[0].volumePercent).toBe(100);
    });

    it('clamps any volume above 0.7 to 100%', () => {
      const pillars = PillarViewUtil.derivePillars(
        EMPTY_LIST,
        EMPTY_LIST,
        EMPTY_LIST,
        [1, 0, 0, 0],
      );
      expect(pillars[0].volumePercent).toBe(100);
    });

    it('reads 0 as 0%', () => {
      const pillars = PillarViewUtil.derivePillars(
        EMPTY_LIST,
        EMPTY_LIST,
        EMPTY_LIST,
        [0, 0, 0, 0],
      );
      expect(pillars[0].volumePercent).toBe(0);
    });

    it('defaults a missing trackVolume entry to 0%', () => {
      const pillars = PillarViewUtil.derivePillars(EMPTY_LIST, EMPTY_LIST, EMPTY_LIST, []);
      expect(pillars[0].volumePercent).toBe(0);
    });
  });

  describe('queued row mapping', () => {
    it('maps a queued clip to { id: rfid, name: clipName }', () => {
      const queued: BrowserClipInfoList = [
        clipFixture(0, 'Vocal Hook 07', ClipTypes.Vox, 'r-abc'),
        null,
        null,
        null,
      ];
      const [pillar] = PillarViewUtil.derivePillars(EMPTY_LIST, queued, EMPTY_LIST, NO_VOLUME);
      expect(pillar.queued).toEqual([{ id: 'r-abc', name: 'Vocal Hook 07' }]);
    });

    it('falls back to clipName as the id when rfid is absent', () => {
      const queued: BrowserClipInfoList = [
        clipFixture(0, 'Vocal Hook 07', ClipTypes.Vox),
        null,
        null,
        null,
      ];
      const [pillar] = PillarViewUtil.derivePillars(EMPTY_LIST, queued, EMPTY_LIST, NO_VOLUME);
      expect(pillar.queued).toEqual([{ id: 'Vocal Hook 07', name: 'Vocal Hook 07' }]);
    });

    it('still surfaces the queued clip even when a different clip is playing (status winner does not gate the queue)', () => {
      const playing: BrowserClipInfoList = [
        clipFixture(0, 'Now Playing', ClipTypes.Vox, 'r1'),
        null,
        null,
        null,
      ];
      const queued: BrowserClipInfoList = [
        clipFixture(0, 'Up Next', ClipTypes.Melody, 'r2'),
        null,
        null,
        null,
      ];

      const [pillar] = PillarViewUtil.derivePillars(playing, queued, EMPTY_LIST, NO_VOLUME);

      expect(pillar.status).toBe('playing');
      expect(pillar.queued).toEqual([{ id: 'r2', name: 'Up Next' }]);
    });
  });
});
