// WOW-007C: payload for the `set_cauldron_volume` socket event, mirroring
// SetTrackVolumeInputType's shape minus the pillar (the cauldron/drum-rack
// track has no pillar semantics - see AbletonAdapter.setCauldronVolume).
export type SetCauldronVolumeInputType = { volume: number };
