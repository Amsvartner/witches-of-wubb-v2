import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SetTrackVolumeInputType } from 'backend/type/SetTrackVolumeInputType';
import { Logger } from '~/util/Logger';
import { BrowserClipInfo } from 'backend/type/BrowserClipInfo';
import { BrowserClipInfoList } from 'backend/type/BrowserClipInfoList';
import { AbletonContextState } from '../type/AbletonContextState';
import { useSocketContext } from '~/context/hook/useSocketContext';
import { ContextUtils } from '~/context/util/ContextUtils';

/* This may seem contrived, but the conventional React pattern is to keep the provider and state + subscriptions separate,
 as to keep single responsibility for each and allow for unit testing state & subscriptions in isolation without having
 to render the component tree and reaching state via consumers. // Vidar
 */
export const useAbletonContextProviderState = (): AbletonContextState => {
  const socket = useSocketContext();
  const { updateIndex } = ContextUtils;

  const [tempo, setTempo] = useState(120);
  const [masterKey, setMasterKey] = useState<string>('');
  const [keylock, setKeylock] = useState<boolean>(true);
  const [trackVolume, setTrackVolume] = useState<number[]>([]);
  const [queuedClips, setQueuedClips] = useState<BrowserClipInfoList>([]);
  const [playingClips, setPlayingClips] = useState<BrowserClipInfoList>([]);
  const [stoppingClips, setStoppingClips] = useState<BrowserClipInfoList>([]);
  const [clipTempo, setClipTempo] = useState<(number | null)[]>([]);

  // The socket subscription effect only re-runs when `socket` changes, so reading
  // playingClips/queuedClips directly inside a handler would capture stale values.
  // Refs give the handlers live access without re-subscribing on every clip change.
  const playingClipsRef = useRef(playingClips);
  const queuedClipsRef = useRef(queuedClips);
  playingClipsRef.current = playingClips;
  queuedClipsRef.current = queuedClips;

  const onUpdatePlayState = useCallback(
    (data: BrowserClipInfo) => {
      // BPM may be undefined at runtime exactly as before; the cast is type-only
      setClipTempo((current) => updateIndex(data.pillar, data.bpm as number | null, current));
      setPlayingClips((current) => updateIndex(data.pillar, data, current));
      setQueuedClips((current) => updateIndex(data.pillar, null, current));
      setStoppingClips((current) => updateIndex(data.pillar, null, current));
    },
    [updateIndex],
  );

  const getTracksAndClips = useCallback(() => {
    socket.emit('get_track_volumes', null, (volumes: number[]) => {
      Logger.debug('get_track_volumes returned:', volumes);
      setTrackVolume(volumes);
    });
    socket.emit('get_playing_clips', null, (playingClips: BrowserClipInfoList) => {
      Logger.debug('get_playing_clips returned:', playingClips);
      setPlayingClips(playingClips);
    });
    socket.emit('get_queued_clips', null, (queuedClips: BrowserClipInfoList) => {
      Logger.debug('get_queued_clips returned:', queuedClips);
      setQueuedClips(queuedClips);
    });
    socket.emit('get_tempo', null, (tempo: number) => {
      Logger.debug('get_tempo returned:', tempo);
      setTempo(tempo);
    });
    socket.emit('get_master-key', null, (key: string) => {
      setMasterKey(key);
    });
    socket?.emit('get_keylock_state', null, (state: boolean) => {
      setKeylock(state);
    });
  }, [socket]);

  const changeTempo = useCallback(
    (tempo: number) => {
      socket?.emit('set_tempo', tempo, (tempo: number) => {
        Logger.debug('change_tempo returned:', tempo);
        setTempo(tempo);
      });
    },
    [socket],
  );

  const changeTrackVolume = useCallback(
    (data: SetTrackVolumeInputType) => {
      socket?.emit('set_track_volume', data);
    },
    [socket],
  );

  const changeMasterKey = useCallback(
    (key: string) => {
      Logger.debug('set_master-key:', key);
      socket?.emit('set_master-key', key);
    },
    [socket],
  );

  const changeKeylock = useCallback(
    (newState: boolean) => {
      socket?.emit('set_keylock_state', newState, (newState: boolean) => {
        setKeylock(newState);
      });
    },
    [socket],
  );

  useEffect(() => {
    // socket starts out as an unconnected placeholder ({} as Socket, see
    // useSocketContextProviderState) with no .on/.off at all - gate on their
    // presence, not on `.connected`, so a real-but-currently-disconnected
    // socket (e.g. this effect happens to (re)run mid-reconnect) still gets
    // every listener - including the 'connect' re-fetch listener below -
    // attached immediately, rather than getting treated the same as the
    // placeholder and permanently missing the future 'connect' that would
    // otherwise trigger the resync (Copilot review, PR #24 - `.connected`
    // alone can't distinguish "not a real socket yet" from "a real socket
    // that's momentarily down"; WOW-035, mirroring WOW-024's identical fix
    // in DebugModalContainer.tsx).
    if (typeof socket.on !== 'function' || typeof socket.off !== 'function') {
      // TODO: Show in UI
      return;
    }

    getTracksAndClips();

    // Re-fetch on every future reconnect too, not just this first connection.
    // socket.io fires 'connect' again on the same persistent Socket instance
    // after a disconnect/reconnect cycle (see useSocketContextProviderState,
    // which no longer tears the connection down when that happens) - this
    // listener catches it without needing this effect to re-run or the
    // socket's object identity to change. getTracksAndClips is stable across
    // reconnects (memoized on `socket`, which doesn't change reference), so
    // the same function reference is used for both `on` and the matching
    // `off` below - registered once, never duplicated (WOW-019).
    socket.on('connect', getTracksAndClips);

    socket.on('ingredient_detected', (data: BrowserClipInfo) => {
      setQueuedClips((current) => updateIndex(data.pillar, data, current));
    });

    socket.on('clip_queued', (data: BrowserClipInfo) => {
      setQueuedClips((current) => updateIndex(data.pillar, data, current));
    });
    socket.on('clip_unqueued', (data: BrowserClipInfo) => {
      setQueuedClips((current) => updateIndex(data.pillar, null, current));
    });

    socket.on('clip_started', onUpdatePlayState);

    socket.on('clip_playing', onUpdatePlayState);

    socket.on('ingredient_removed', (data: BrowserClipInfo) => {
      if (playingClipsRef.current[data.pillar]?.clipName === data.clipName) {
        setPlayingClips((current) => updateIndex(data.pillar, null, current));
        setStoppingClips((current) => updateIndex(data.pillar, data, current));
      } else if (queuedClipsRef.current[data.pillar]?.clipName === data.clipName) {
        setQueuedClips((current) => updateIndex(data.pillar, null, current));
      }
    });

    socket.on('clip_stopping', (data: BrowserClipInfo) => {
      setPlayingClips((current) => updateIndex(data.pillar, null, current));
      setStoppingClips((current) => updateIndex(data.pillar, data, current));
    });

    socket.on('clip_stopped', ({ pillar }: { pillar: number }) => {
      setClipTempo((current) => updateIndex(pillar, null, current));
      setPlayingClips((current) => updateIndex(pillar, null, current));
      setStoppingClips((current) => updateIndex(pillar, null, current));
    });
    socket.on('tempo_changed', ({ tempo }: { tempo: number }) => {
      setTempo(tempo);
    });
    socket.on('volume_changed', (data: SetTrackVolumeInputType) => {
      setTrackVolume((current) => updateIndex(data.pillar, data.volume, current));
    });
    socket.on('master-key_changed', ({ key }: { key: string }) => {
      setMasterKey(key);
    });

    return () => {
      socket.off('connect', getTracksAndClips);
      socket.off('ingredient_detected');
      socket.off('clip_queued');
      socket.off('clip_unqueued');
      socket.off('clip_started', onUpdatePlayState);
      socket.off('clip_playing', onUpdatePlayState);
      socket.off('ingredient_removed');
      socket.off('clip_stopping');
      socket.off('clip_stopped');
      socket.off('tempo_changed');
      socket.off('volume_changed');
      socket.off('master-key_changed');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  return useMemo(
    () => ({
      changeKeylock,
      changeMasterKey,
      changeTempo,
      changeTrackVolume,
      clipTempo,
      getTracksAndClips,
      keylock,
      masterKey,
      playingClips,
      queuedClips,
      stoppingClips,
      tempo,
      trackVolume,
    }),
    [
      changeKeylock,
      changeMasterKey,
      changeTempo,
      changeTrackVolume,
      clipTempo,
      getTracksAndClips,
      keylock,
      masterKey,
      playingClips,
      queuedClips,
      stoppingClips,
      tempo,
      trackVolume,
    ],
  );
};
