import { BrowserClipInfo } from 'backend/type/BrowserClipInfo';
import { BrowserClipInfoList } from 'backend/type/BrowserClipInfoList';
import { ClipTypes } from 'backend/type/ClipTypes';
import { type PillarDraft, type SelectableClip } from '~/component/SampleModal';
import { PillarDraftUtil } from '~/util/PillarDraftUtil';

const clip = (rfid: string, clipName = rfid): SelectableClip => ({
  rfid,
  clipName,
  type: ClipTypes.Vox,
});

const CLIP_A = clip('rfid-a', 'Alpha');
const CLIP_B = clip('rfid-b', 'Beta');
const CLIP_C = clip('rfid-c', 'Gamma');
const CLIP_D = clip('rfid-d', 'Delta');

const browserClip = (pillar: number, rfid: string, clipName = rfid): BrowserClipInfo => ({
  pillar,
  rfid,
  clipName,
  type: ClipTypes.Vox,
  assetName: 'Vox.png',
});

const emptyList = (): BrowserClipInfoList => [null, null, null, null];

const emptyPicks = (): SelectableClip[][] => [[], [], [], []];

const emptyDraft = (): PillarDraft[] => [
  { entries: [] },
  { entries: [] },
  { entries: [] },
  { entries: [] },
];

const NO_LIVE: (string | null)[] = [null, null, null, null];

describe('PillarDraftUtil (WOW-007C draft/apply model)', () => {
  describe('buildBaseline', () => {
    it('maps playing -> play entry, backend-queued and pending picks -> queued entries', () => {
      const playingClips = emptyList();
      playingClips[0] = browserClip(0, 'rfid-a', 'Alpha');
      const queuedClips = emptyList();
      queuedClips[1] = browserClip(1, 'rfid-b', 'Beta');
      const pendingPicks = emptyPicks();
      pendingPicks[2] = [CLIP_C];

      const baseline = PillarDraftUtil.buildBaseline({
        playingClips,
        stoppingClips: emptyList(),
        queuedClips,
        pendingPicks,
        catalogue: [CLIP_A, CLIP_B, CLIP_C],
      });

      expect(baseline[0].entries).toEqual([{ clip: CLIP_A, state: 'play' }]);
      expect(baseline[1].entries).toEqual([{ clip: CLIP_B, state: 'queued' }]);
      expect(baseline[2].entries).toEqual([{ clip: CLIP_C, state: 'queued' }]);
      expect(baseline[3].entries).toEqual([]);
    });

    it('treats a stopping clip as the pillar’s play entry (it still occupies the pillar)', () => {
      const stoppingClips = emptyList();
      stoppingClips[1] = browserClip(1, 'rfid-a', 'Alpha');

      const baseline = PillarDraftUtil.buildBaseline({
        playingClips: emptyList(),
        stoppingClips,
        queuedClips: emptyList(),
        pendingPicks: emptyPicks(),
        catalogue: [CLIP_A],
      });

      expect(baseline[1].entries).toEqual([{ clip: CLIP_A, state: 'play' }]);
    });

    it('enriches live clips from the catalogue (bpm/key/instrument) by rfid', () => {
      const richClip: SelectableClip = { ...CLIP_A, bpm: 128, key: '4A', instrument: 'Vox' };
      const playingClips = emptyList();
      playingClips[0] = browserClip(0, 'rfid-a', 'Alpha');

      const baseline = PillarDraftUtil.buildBaseline({
        playingClips,
        stoppingClips: emptyList(),
        queuedClips: emptyList(),
        pendingPicks: emptyPicks(),
        catalogue: [richClip],
      });

      expect(baseline[0].entries[0].clip).toBe(richClip);
    });

    it('caps a pillar at 2 entries (play + oldest queued win)', () => {
      const playingClips = emptyList();
      playingClips[0] = browserClip(0, 'rfid-a', 'Alpha');
      const queuedClips = emptyList();
      queuedClips[0] = browserClip(0, 'rfid-b', 'Beta');
      const pendingPicks = emptyPicks();
      pendingPicks[0] = [CLIP_C, CLIP_D];

      const baseline = PillarDraftUtil.buildBaseline({
        playingClips,
        stoppingClips: emptyList(),
        queuedClips,
        pendingPicks,
        catalogue: [CLIP_A, CLIP_B, CLIP_C, CLIP_D],
      });

      expect(baseline[0].entries).toEqual([
        { clip: CLIP_A, state: 'play' },
        { clip: CLIP_B, state: 'queued' },
      ]);
    });
  });

  describe('tapChip transitions', () => {
    it('outlined -> queued (gold)', () => {
      const next = PillarDraftUtil.tapChip({
        draft: emptyDraft(),
        pillarIndex: 1,
        clip: CLIP_A,
        liveRfids: NO_LIVE,
      });

      expect(next[1].entries).toEqual([{ clip: CLIP_A, state: 'queued' }]);
    });

    it('queued -> play (green)', () => {
      const draft = emptyDraft();
      draft[1].entries = [{ clip: CLIP_A, state: 'queued' }];

      const next = PillarDraftUtil.tapChip({
        draft,
        pillarIndex: 1,
        clip: CLIP_A,
        liveRfids: NO_LIVE,
      });

      expect(next[1].entries).toEqual([{ clip: CLIP_A, state: 'play' }]);
    });

    it('play -> removed', () => {
      const draft = emptyDraft();
      draft[1].entries = [{ clip: CLIP_A, state: 'play' }];

      const next = PillarDraftUtil.tapChip({
        draft,
        pillarIndex: 1,
        clip: CLIP_A,
        liveRfids: NO_LIVE,
      });

      expect(next[1].entries).toEqual([]);
    });

    it('does not mutate the input draft', () => {
      const draft = emptyDraft();
      draft[0].entries = [{ clip: CLIP_A, state: 'queued' }];
      const inputEntries = draft[0].entries;

      PillarDraftUtil.tapChip({ draft, pillarIndex: 0, clip: CLIP_A, liveRfids: NO_LIVE });

      expect(draft[0].entries).toBe(inputEntries);
      expect(draft[0].entries).toEqual([{ clip: CLIP_A, state: 'queued' }]);
    });

    it('promoting a second entry to play demotes the existing draft-only play entry to queued', () => {
      const draft = emptyDraft();
      draft[0].entries = [
        { clip: CLIP_A, state: 'play' },
        { clip: CLIP_B, state: 'queued' },
      ];

      const next = PillarDraftUtil.tapChip({
        draft,
        pillarIndex: 0,
        clip: CLIP_B,
        liveRfids: NO_LIVE,
      });

      expect(next[0].entries).toEqual([
        { clip: CLIP_A, state: 'queued' },
        { clip: CLIP_B, state: 'play' },
      ]);
    });

    it('promoting over the CURRENTLY-PLAYING clip removes it instead of demoting (cannot un-play into a queue)', () => {
      const draft = emptyDraft();
      draft[0].entries = [
        { clip: CLIP_A, state: 'play' },
        { clip: CLIP_B, state: 'queued' },
      ];
      const liveRfids: (string | null)[] = ['rfid-a', null, null, null];

      const next = PillarDraftUtil.tapChip({ draft, pillarIndex: 0, clip: CLIP_B, liveRfids });

      expect(next[0].entries).toEqual([{ clip: CLIP_B, state: 'play' }]);
    });

    it('re-adding the pillar’s currently-playing clip goes straight to play — no gold state for a live clip', () => {
      // The clip is live on pillar 0 but was removed from the draft (green ->
      // removed); tapping its chip again must not offer "queue" (impossible).
      const liveRfids: (string | null)[] = ['rfid-a', null, null, null];

      const next = PillarDraftUtil.tapChip({
        draft: emptyDraft(),
        pillarIndex: 0,
        clip: CLIP_A,
        liveRfids,
      });

      expect(next[0].entries).toEqual([{ clip: CLIP_A, state: 'play' }]);
    });

    it('re-adding the live clip as play demotes a draft-only play entry that took its slot', () => {
      const draft = emptyDraft();
      draft[0].entries = [{ clip: CLIP_B, state: 'play' }];
      const liveRfids: (string | null)[] = ['rfid-a', null, null, null];

      const next = PillarDraftUtil.tapChip({ draft, pillarIndex: 0, clip: CLIP_A, liveRfids });

      expect(next[0].entries).toEqual([
        { clip: CLIP_B, state: 'queued' },
        { clip: CLIP_A, state: 'play' },
      ]);
    });

    describe('2-per-pillar cap and eviction', () => {
      it('adding a third clip evicts the OLDEST queued entry', () => {
        const draft = emptyDraft();
        draft[0].entries = [
          { clip: CLIP_A, state: 'queued' },
          { clip: CLIP_B, state: 'queued' },
        ];

        const next = PillarDraftUtil.tapChip({
          draft,
          pillarIndex: 0,
          clip: CLIP_C,
          liveRfids: NO_LIVE,
        });

        expect(next[0].entries).toEqual([
          { clip: CLIP_B, state: 'queued' },
          { clip: CLIP_C, state: 'queued' },
        ]);
      });

      it('never auto-evicts a play entry — with play + queued, the queued one goes', () => {
        const draft = emptyDraft();
        draft[0].entries = [
          { clip: CLIP_A, state: 'play' },
          { clip: CLIP_B, state: 'queued' },
        ];

        const next = PillarDraftUtil.tapChip({
          draft,
          pillarIndex: 0,
          clip: CLIP_C,
          liveRfids: NO_LIVE,
        });

        expect(next[0].entries).toEqual([
          { clip: CLIP_A, state: 'play' },
          { clip: CLIP_C, state: 'queued' },
        ]);
      });
    });

    describe('one pillar per clip (move semantics)', () => {
      it('adding a clip to a pillar removes it from any other pillar’s draft', () => {
        const draft = emptyDraft();
        draft[0].entries = [{ clip: CLIP_A, state: 'queued' }];

        const next = PillarDraftUtil.tapChip({
          draft,
          pillarIndex: 2,
          clip: CLIP_A,
          liveRfids: NO_LIVE,
        });

        expect(next[0].entries).toEqual([]);
        expect(next[2].entries).toEqual([{ clip: CLIP_A, state: 'queued' }]);
      });

      it('moves a draft play entry too — a playing sample is movable between pillars', () => {
        const draft = emptyDraft();
        draft[0].entries = [{ clip: CLIP_A, state: 'play' }];
        const liveRfids: (string | null)[] = ['rfid-a', null, null, null];

        const next = PillarDraftUtil.tapChip({ draft, pillarIndex: 3, clip: CLIP_A, liveRfids });

        expect(next[0].entries).toEqual([]);
        expect(next[3].entries).toEqual([{ clip: CLIP_A, state: 'queued' }]);
      });
    });
  });

  describe('draftsEqual', () => {
    it('is true for same entries regardless of order within a pillar', () => {
      const a = emptyDraft();
      a[0].entries = [
        { clip: CLIP_A, state: 'play' },
        { clip: CLIP_B, state: 'queued' },
      ];
      const b = emptyDraft();
      b[0].entries = [
        { clip: CLIP_B, state: 'queued' },
        { clip: CLIP_A, state: 'play' },
      ];

      expect(PillarDraftUtil.draftsEqual(a, b)).toBe(true);
    });

    it('is false when a state differs for the same clip', () => {
      const a = emptyDraft();
      a[0].entries = [{ clip: CLIP_A, state: 'play' }];
      const b = emptyDraft();
      b[0].entries = [{ clip: CLIP_A, state: 'queued' }];

      expect(PillarDraftUtil.draftsEqual(a, b)).toBe(false);
    });

    it('is false when the same clip sits on a different pillar', () => {
      const a = emptyDraft();
      a[0].entries = [{ clip: CLIP_A, state: 'queued' }];
      const b = emptyDraft();
      b[1].entries = [{ clip: CLIP_A, state: 'queued' }];

      expect(PillarDraftUtil.draftsEqual(a, b)).toBe(false);
    });
  });

  describe('diffForApply', () => {
    it('emits nothing for a draft matching reality', () => {
      const playingClips = emptyList();
      playingClips[0] = browserClip(0, 'rfid-a', 'Alpha');
      const draft = emptyDraft();
      draft[0].entries = [{ clip: CLIP_A, state: 'play' }];

      const { emissions, nextPendingPicks } = PillarDraftUtil.diffForApply({
        draft,
        playingClips,
        stoppingClips: emptyList(),
        queuedClips: emptyList(),
      });

      expect(emissions).toEqual([]);
      expect(nextPendingPicks).toEqual([[], [], [], []]);
    });

    it('departs a playing clip that was removed from its pillar’s draft', () => {
      const playingClips = emptyList();
      playingClips[1] = browserClip(1, 'rfid-a', 'Alpha');

      const { emissions } = PillarDraftUtil.diffForApply({
        draft: emptyDraft(),
        playingClips,
        stoppingClips: emptyList(),
        queuedClips: emptyList(),
      });

      expect(emissions).toEqual([{ event: '/departed/tag', rfid: 'rfid-a', pillar: 1 }]);
    });

    it('departs a backend-queued clip that was removed from its pillar’s draft', () => {
      const queuedClips = emptyList();
      queuedClips[2] = browserClip(2, 'rfid-b', 'Beta');

      const { emissions } = PillarDraftUtil.diffForApply({
        draft: emptyDraft(),
        playingClips: emptyList(),
        stoppingClips: emptyList(),
        queuedClips,
      });

      expect(emissions).toEqual([{ event: '/departed/tag', rfid: 'rfid-b', pillar: 2 }]);
    });

    it('keeps a backend-queued clip that is still drafted queued on its pillar — no emission, no pending pick', () => {
      const queuedClips = emptyList();
      queuedClips[0] = browserClip(0, 'rfid-b', 'Beta');
      const draft = emptyDraft();
      draft[0].entries = [{ clip: CLIP_B, state: 'queued' }];

      const { emissions, nextPendingPicks } = PillarDraftUtil.diffForApply({
        draft,
        playingClips: emptyList(),
        stoppingClips: emptyList(),
        queuedClips,
      });

      expect(emissions).toEqual([]);
      expect(nextPendingPicks[0]).toEqual([]);
    });

    it('emits /new/tag for a draft play entry on an idle pillar', () => {
      const draft = emptyDraft();
      draft[3].entries = [{ clip: CLIP_C, state: 'play' }];

      const { emissions } = PillarDraftUtil.diffForApply({
        draft,
        playingClips: emptyList(),
        stoppingClips: emptyList(),
        queuedClips: emptyList(),
      });

      expect(emissions).toEqual([{ event: '/new/tag', rfid: 'rfid-c', pillar: 3 }]);
    });

    it('orders ALL /departed/tag emissions before ALL /new/tag emissions (replace + move in one apply)', () => {
      // Reality: A playing on P1, B backend-queued on P2.
      // Draft: C to play on P1 (replaces A), B moved to play on P3.
      const playingClips = emptyList();
      playingClips[0] = browserClip(0, 'rfid-a', 'Alpha');
      const queuedClips = emptyList();
      queuedClips[1] = browserClip(1, 'rfid-b', 'Beta');
      const draft = emptyDraft();
      draft[0].entries = [{ clip: CLIP_C, state: 'play' }];
      draft[2].entries = [{ clip: CLIP_B, state: 'play' }];

      const { emissions } = PillarDraftUtil.diffForApply({
        draft,
        playingClips,
        stoppingClips: emptyList(),
        queuedClips,
      });

      expect(emissions).toEqual([
        { event: '/departed/tag', rfid: 'rfid-a', pillar: 0 },
        { event: '/departed/tag', rfid: 'rfid-b', pillar: 1 },
        { event: '/new/tag', rfid: 'rfid-c', pillar: 0 },
        { event: '/new/tag', rfid: 'rfid-b', pillar: 2 },
      ]);
    });

    it('does not re-emit /new/tag for a play entry that is already the pillar’s live clip', () => {
      const playingClips = emptyList();
      playingClips[0] = browserClip(0, 'rfid-a', 'Alpha');
      const draft = emptyDraft();
      draft[0].entries = [
        { clip: CLIP_A, state: 'play' },
        { clip: CLIP_B, state: 'queued' },
      ];

      const { emissions, nextPendingPicks } = PillarDraftUtil.diffForApply({
        draft,
        playingClips,
        stoppingClips: emptyList(),
        queuedClips: emptyList(),
      });

      expect(emissions).toEqual([]);
      expect(nextPendingPicks[0]).toEqual([CLIP_B]);
    });

    it('turns draft queued entries that are not backend-queued into the pillar’s pending picks, in order', () => {
      const draft = emptyDraft();
      draft[1].entries = [
        { clip: CLIP_C, state: 'queued' },
        { clip: CLIP_D, state: 'queued' },
      ];

      const { emissions, nextPendingPicks } = PillarDraftUtil.diffForApply({
        draft,
        playingClips: emptyList(),
        stoppingClips: emptyList(),
        queuedClips: emptyList(),
      });

      expect(emissions).toEqual([]);
      expect(nextPendingPicks[1]).toEqual([CLIP_C, CLIP_D]);
    });

    it('de-queues a backend-queued clip promoted to play, so its /new/tag is not dropped as a duplicate', () => {
      // CLIP_A is backend-queued on pillar 0 and the draft promotes it to
      // 'play'. A bare /new/tag would be ignored by the backend's
      // already-queued guard ("Clip X is already queued"), so the diff must
      // depart it first, then re-place it — departed before new, as always.
      const queuedClips = emptyList();
      queuedClips[0] = browserClip(0, CLIP_A.rfid, CLIP_A.clipName);
      const draft = emptyDraft();
      draft[0] = { entries: [{ clip: CLIP_A, state: 'play' }] };

      const { emissions, nextPendingPicks } = PillarDraftUtil.diffForApply({
        draft,
        playingClips: emptyList(),
        stoppingClips: emptyList(),
        queuedClips,
      });

      expect(emissions).toEqual([
        { event: '/departed/tag', rfid: CLIP_A.rfid, pillar: 0 },
        { event: '/new/tag', rfid: CLIP_A.rfid, pillar: 0 },
      ]);
      expect(nextPendingPicks[0]).toEqual([]);
    });

    it('keeps a backend-queued clip un-departed while it stays drafted as queued', () => {
      const queuedClips = emptyList();
      queuedClips[0] = browserClip(0, CLIP_A.rfid, CLIP_A.clipName);
      const draft = emptyDraft();
      draft[0] = { entries: [{ clip: CLIP_A, state: 'queued' }] };

      const { emissions } = PillarDraftUtil.diffForApply({
        draft,
        playingClips: emptyList(),
        stoppingClips: emptyList(),
        queuedClips,
      });

      expect(emissions).toEqual([]);
    });
  });
});
