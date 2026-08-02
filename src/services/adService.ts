export const adService = {
  isAvailable(): boolean {
    return false;
  },

  async initialize(): Promise<void> {},

  /**
   * Call after a user successfully sends any chat message.
   * No-op on web — ads are only shown in the native app
   * (see adService.native.ts).
   */
  async onChatMessageSent(): Promise<void> {},

  /** Native-only persistent counter for friend discovery card transitions. */
  async onDiscoverySlide(_userId?: string): Promise<void> {},
};
