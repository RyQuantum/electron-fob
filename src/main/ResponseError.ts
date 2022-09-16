export default class ResponseError extends Error {
  private extraParam: string;

  constructor(message: string, res: string) {
    super(message);
    this.extraParam = res;
  }

  get res() {
    return this.extraParam;
  }
}
