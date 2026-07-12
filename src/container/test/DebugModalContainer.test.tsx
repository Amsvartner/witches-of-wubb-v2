import { fireEvent, render, screen } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { Socket } from 'socket.io-client';
import { vi } from 'vitest';
import { ClipTypes } from 'backend/type/ClipTypes';
import { DebugModalContainer } from '~/container/DebugModalContainer';
import { AbletonContext } from '~/context/AbletonContext';
import { AbletonContextState } from '~/context/type/AbletonContextState';
import { SocketContext } from '~/context/SocketContext';

// Real clip names can contain spaces (e.g. `"Doink U" Vox 122`, per WOW-016) - a
// synthetic name is used here (rather than a real CSV entry) so this test can't collide
// with the "available clips" list, which is built from the real Music Database.csv and
// would otherwise render the same clip name a second time on other pillars. The
// space-stripped clipNameToInfoMap lookup this test guards against threw on exactly
// this shape, since queued_clip events arrive with the raw (spaced) clip name.
const SPACED_CLIP_NAME = 'Test Fixture Clip With Spaces 5A 100';
const SPACED_CLIP_RFID = 'test-fixture-rfid-0001';
const QUEUED_PILLAR_INDEX = 1;

const abletonStub: AbletonContextState = {
  getTracksAndClips: () => {},
  changeTempo: () => {},
  changeTrackVolume: () => {},
  tempo: 120,
  trackVolume: [],
  queuedClips: [
    null,
    {
      pillar: QUEUED_PILLAR_INDEX,
      clipName: SPACED_CLIP_NAME,
      rfid: SPACED_CLIP_RFID,
      type: ClipTypes.Melody,
      assetName: 'doink-u',
      artist: 'Doink',
      songTitle: 'U',
    },
    null,
    null,
  ],
  playingClips: [null, null, null, null],
  stoppingClips: [null, null, null, null],
  clipTempo: [],
  masterKey: '',
  changeMasterKey: () => {},
  keylock: true,
  changeKeylock: () => {},
};

function renderModal(socket: Socket) {
  const wrapper = ({ children }: PropsWithChildren) => (
    <SocketContext.Provider value={socket}>
      <AbletonContext.Provider value={abletonStub}>{children}</AbletonContext.Provider>
    </SocketContext.Provider>
  );
  return render(<DebugModalContainer isModalOpen setIsModalOpen={() => {}} />, { wrapper });
}

describe('DebugModalContainer', () => {
  it('unqueues a clip whose name contains spaces without throwing, using rfid directly', () => {
    const emit = vi.fn();
    const socket = { emit } as unknown as Socket;

    // The .not.toThrow() wrappers below are belt-and-suspenders only: in this
    // React/jsdom stack, fireEvent.click() never rethrows an onClick handler's
    // exception to the caller (jsdom reports it per-listener instead - see
    // EventTarget-impl.js), so they can't actually fail here. The real regression
    // guard against the pre-fix crash is the toHaveBeenCalledWith assertion below -
    // pre-fix, the handler throws before reaching emit(), so emit is never called
    // and that assertion fails cleanly. Don't remove it while trusting the
    // .not.toThrow() lines to still catch the bug.
    expect(() => renderModal(socket)).not.toThrow();

    const clipButton = screen.getByText(SPACED_CLIP_NAME).closest('button');
    expect(clipButton).not.toBeNull();

    expect(() => fireEvent.click(clipButton as HTMLButtonElement)).not.toThrow();

    expect(emit).toHaveBeenCalledWith('/departed/tag', {
      rfid: SPACED_CLIP_RFID,
      pillar: QUEUED_PILLAR_INDEX,
    });
  });
});
