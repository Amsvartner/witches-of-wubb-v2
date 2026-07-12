import { Fragment, useEffect, useState } from 'react';
import { ClipDatabaseUtil } from '~/util/ClipDatabaseUtil';
import { ClipButton } from '~/component/ClipButton';
import { Dialog, Transition } from '@headlessui/react';
import { useAbletonContext } from '~/context/hook/useAbletonContext';
import { useSocketContext } from '~/context/hook/useSocketContext';
import { Logger } from '~/util/Logger';

const clips = Object.entries(ClipDatabaseUtil.rfidToClipMap)
  .map(([rfid, data]) => ({ ...data, rfid }))
  .sort((a, b) => {
    if (a && b) return a?.clipName?.localeCompare(b?.clipName);
    return 0;
  });

type Props = {
  isModalOpen: boolean;
  setIsModalOpen: (state: boolean) => void;
};

export const DebugModalContainer = ({ isModalOpen, setIsModalOpen }: Props): JSX.Element => {
  const socket = useSocketContext();
  const { playingClips, queuedClips, stoppingClips } = useAbletonContext();

  // socket starts out as an unconnected placeholder ({} as Socket, see
  // useSocketContextProviderState) with no .on/.off at all - gate on their
  // presence, not on `.connected`, so a real-but-currently-disconnected
  // socket (e.g. this component happens to (re)run its effect mid-reconnect)
  // still gets its listeners attached immediately, rather than getting
  // treated the same as the placeholder and permanently missing the future
  // 'connect' that would otherwise flip isConnected back (Copilot review,
  // PR #24 - `.connected` alone can't distinguish "not a real socket yet"
  // from "a real socket that's momentarily down").
  const [isConnected, setIsConnected] = useState(Boolean(socket.connected));

  useEffect(() => {
    setIsConnected(Boolean(socket.connected));
    if (typeof socket.on !== 'function' || typeof socket.off !== 'function') return;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  function toggleSong(rfid: string, pillar: number, start: boolean) {
    if (!isConnected) {
      Logger.warn('Ignored clip toggle: socket not connected');
      return;
    }
    if (start) {
      socket.emit('/new/tag', { rfid, pillar });
    } else {
      socket.emit('/departed/tag', { rfid, pillar });
    }
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  useEffect(() => {
    if (isModalOpen) {
      Logger.enableDebug();
      return Logger.disableDebug;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen]);

  return (
    <Transition appear show={isModalOpen} as={Fragment}>
      <Dialog as='div' className='relative z-10' onClose={closeModal}>
        <Transition.Child
          as={Fragment}
          enter='ease-out duration-300'
          enterFrom='opacity-0'
          enterTo='opacity-100'
          leave='ease-in duration-200'
          leaveFrom='opacity-100'
          leaveTo='opacity-0'
        >
          <div className='fixed inset-0 bg-black bg-opacity-25' />
        </Transition.Child>

        <div className='fixed inset-0 '>
          <div className='flex w-full h-full max-h-screen items-center justify-center'>
            <Transition.Child
              as={Fragment}
              enter='ease-out duration-300'
              enterFrom='opacity-0 scale-95'
              enterTo='opacity-100 scale-100'
              leave='ease-in duration-200'
              leaveFrom='opacity-100 scale-100'
              leaveTo='opacity-0 scale-95'
            >
              <Dialog.Panel className='w-screen max-w-xxl transform rounded-md bg-white text-black text-left align-middle shadow-xl transition-all'>
                {!isConnected && (
                  <div className='bg-yellow-100 text-yellow-900 text-sm text-center py-2'>
                    Connecting to backend…
                  </div>
                )}
                <div
                  className={`overflow-scroll max-h-[calc(100vh-4rem)] ${
                    isConnected ? '' : 'opacity-50 pointer-events-none'
                  }`}
                >
                  <div className='grid gap-8 grid-flow-col'>
                    {[1, 2, 3, 4].map((pillar, index) => {
                      const stopping = Boolean(stoppingClips[index]?.clipName);
                      const playingClip = stoppingClips[index] ?? playingClips[index];
                      const queuedClip = queuedClips[index];

                      return (
                        <div key={pillar} className='grid grid-flow-row auto-rows-max'>
                          <div className='sticky top-0 bg-white z-10 pt-4'>
                            <div className='text-lg'>Pillar {pillar}</div>
                            <div style={{ minHeight: 72 }}>
                              <div className='text-sm'>{stopping ? 'stopping' : 'playing'}:</div>
                              {playingClip && (
                                <div>
                                  <ClipButton
                                    stopping={stopping}
                                    playing={!stopping}
                                    clipName={playingClip.clipName}
                                    onClick={() => toggleSong(playingClip.rfid, index, false)}
                                  />
                                </div>
                              )}
                            </div>
                            <div style={{ minHeight: 72 }}>
                              <div className='text-sm'>queued:</div>
                              {queuedClip && (
                                <div>
                                  <ClipButton
                                    queued
                                    clipName={queuedClip.clipName}
                                    onClick={() => toggleSong(queuedClip.rfid, index, false)}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className='grid gap-4'>
                            <hr />
                            {clips.map(({ rfid, clipName }) => {
                              const playing = playingClips[index]?.clipName === clipName;
                              const stopping = stoppingClips[index]?.clipName === clipName;
                              const queued = queuedClips[index]?.clipName === clipName;

                              return (
                                !stopping &&
                                !playing &&
                                !queued && (
                                  <ClipButton
                                    key={rfid}
                                    clipName={clipName}
                                    onClick={() => toggleSong(rfid, index, true)}
                                  />
                                )
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className='p-6'>
                  <button
                    type='button'
                    className='inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'
                    onClick={closeModal}
                  >
                    Exit
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};
