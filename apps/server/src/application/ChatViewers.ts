/** Which chats a person is looking at right now (the page is visible and that chat is on screen), per connection. */
export class ChatViewers {
  private readonly viewing = new Map<string, Set<object>>();

  set(sessionId: string, connection: object, viewing: boolean): void {
    const set = this.viewing.get(sessionId) ?? new Set<object>();
    if (viewing) set.add(connection);
    else set.delete(connection);
    if (set.size > 0) this.viewing.set(sessionId, set);
    else this.viewing.delete(sessionId);
  }

  /** A connection closed: it no longer looks at anything. */
  drop(sessionId: string, connection: object): void {
    this.set(sessionId, connection, false);
  }

  isViewed(sessionId: string): boolean {
    return (this.viewing.get(sessionId)?.size ?? 0) > 0;
  }
}
