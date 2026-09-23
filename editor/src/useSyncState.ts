import { useSyncExternalStore } from "react";
import { getState, subscribe, type AppState } from "./store";

export function useSyncState(): AppState {
	return useSyncExternalStore(subscribe, getState, getState);
}
