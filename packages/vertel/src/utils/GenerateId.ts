export default class GenerateId {
  #counter = 0;

  create = (): string => {
    this.#counter += 1;

    return this.#counter.toString();
  };
}
