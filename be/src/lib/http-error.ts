/** 클라이언트에 그대로 노출해도 되는 오류. 이 타입이 아니면 500으로 감춘다. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
