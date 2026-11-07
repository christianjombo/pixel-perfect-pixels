import { createDemoStore } from "./demo-store";

/** Test/Live switch shared by every dashboard page so it doesn't reset when you change page. */
export const liveModeStore = createDemoStore(true);
export const useLiveMode = () => liveModeStore.use();
export const setLiveMode = (v: boolean) => liveModeStore.set(v);
