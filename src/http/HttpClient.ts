// src/http/HttpClient.ts
export type FetchLike = typeof fetch;

export class HttpClient {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  request(url: string, init?: RequestInit): Promise<Response> {
    return this.fetchImpl(url, init);
  }
}
