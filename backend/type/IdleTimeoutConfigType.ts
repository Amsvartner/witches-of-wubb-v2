// WOW-007C: the idle-timeout ("pause music"/attractor handover) config,
// shared by AbletonAdapter.getIdleTimeoutConfig/setIdleTimeoutConfig, the
// `get_idle_timeout`/`set_idle_timeout` socket events, and the frontend
// Settings modal's pause-music toggle + minutes control.
export type IdleTimeoutConfigType = { enabled: boolean; timeoutMs: number };
