type Props = {
  children: string;
};

/** Small-caps, letter-spaced section label ("QUEUED", "TEMPO") — §3.4 type/label. */
export const SectionLabel = ({ children }: Props): JSX.Element => (
  <p className='font-data text-[11px] font-medium uppercase tracking-[0.18em] text-parchment/50'>
    {children}
  </p>
);
