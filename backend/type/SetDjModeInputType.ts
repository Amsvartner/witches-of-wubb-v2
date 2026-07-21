// WOW-007C item 4: payload for the `set_dj_mode` socket event — the frontend
// tells the backend whenever DJ mode is entered/exited (including on every
// reconnect, since backend-side djModeActive is not persisted across a
// restart — see AbletonAdapter.setDjModeActive) so the idle-timeout handover
// to the Live-set attractor can be suppressed for the duration of supervised
// DJ operation.
export type SetDjModeInputType = { active: boolean };
