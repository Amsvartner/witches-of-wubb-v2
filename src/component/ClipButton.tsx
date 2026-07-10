import { Switch } from '@headlessui/react';
import classNames from 'classnames';

type Props = {
  clipName: string;
  stopping?: boolean;
  playing?: boolean;
  queued?: boolean;
  onClick: () => void;
};

export const ClipButton = ({
  clipName,
  stopping,
  playing,
  queued,
  onClick,
}: Props): JSX.Element => {
  const classes = classNames({
    'text-red-600 animate-pulse': stopping,
    'text-green-600': playing && !stopping,
    'text-green-500 animate-pulse': queued,
    // 'text-sm': !loopLeader,
    'gap-4': true,
  });

  return (
    <div key={clipName} className={classes}>
      <button onClick={onClick} className='grid grid-flow-col items-start gap-2'>
        <Switch
          as='div'
          checked={(playing || queued) ?? false}
          className={`relative inline-flex h-6 w-11 items-center rounded-full ${
            playing || queued
              ? 'ui-checked:bg-green-600'
              : stopping
              ? 'ui-not-checked:bg-red-600'
              : ''
          } ui-not-checked:bg-gray-200`}
        >
          <span className='sr-only'>Play clip</span>
          <span
            className={`${playing || queued ? 'translate-x-6' : 'translate-x-1'}
          inline-block h-4 w-4 transform rounded-full bg-white transition`}
          />
        </Switch>

        <div>{clipName}</div>
      </button>
    </div>
  );
};
