import crypto from 'crypto';

export default class Encryption {
  // default key of FM1208
  secretKeyStr = 'FFFFFFFFFFFFFFFF';

  #secretKeySub1 = '';

  #secretKeySub2 = '';

  algorithms = 'des-ecb';

  /**
   * @param {String} secretKey        either 16 or 32 length
   */
  constructor(secretKey: string) {
    if (secretKey.length !== 16 && secretKey?.length !== 32) {
      throw new Error('The key length should be either 16 or 32.');
    }
    if (secretKey) this.secretKeyStr = secretKey;
    this.#secretKeySub1 = this.secretKeyStr.substring(0, 16);
    this.#secretKeySub2 = this.secretKeyStr.substring(16, 32);
  }

  #encrypt(plainBuf: Buffer, secretKey: Buffer) {
    const key = new Uint8Array(secretKey);
    const iv = new Uint8Array();
    const plain = new Uint8Array(plainBuf);
    const cipher = crypto.createCipheriv(this.algorithms, key, iv);
    cipher.setAutoPadding(true);
    const ciph = cipher.update(plain);
    return ciph;
  }

  #decrypt(encryptedBuf: Buffer, secretKey: Buffer) {
    const key = new Uint8Array(secretKey);
    const iv = new Uint8Array();
    const txt = new Uint8Array(encryptedBuf);
    const deCipher = crypto.createDecipheriv(this.algorithms, key, iv);
    deCipher.setAutoPadding(true);
    deCipher.update(txt);
    const ciph = deCipher.update(txt);
    return ciph;
  }

  /**
   * DES encryption
   * @param {String} plainText
   * @returns {String} encryptedText
   *
   */
  encryptDes = (plainText: string) => {
    const buffer = Buffer.from(plainText, 'hex');
    return this.#encrypt(
      buffer,
      Buffer.from(this.#secretKeySub1, 'hex')
    ).toString('hex');
  };

  /**
   * DES decryption
   * @param {String} encryptedText
   * @returns {String} plainText
   *
   */
  decryptDes = (encryptedText: string) => {
    const buffer = Buffer.from(encryptedText, 'hex');
    return this.#decrypt(
      buffer,
      Buffer.from(this.#secretKeySub1, 'hex')
    ).toString('hex');
  };

  /**
   * 3DES encryption
   * @param {String} plainText
   * @returns {String} encryptedText
   *
   */
  encrypt3Des = (plainText: string) => {
    let tmp1 = this.#encrypt(
      Buffer.from(plainText, 'hex'),
      Buffer.from(this.#secretKeySub1, 'hex')
    );
    const tmp2 = this.#decrypt(tmp1, Buffer.from(this.#secretKeySub2, 'hex'));
    tmp1 = this.#encrypt(tmp2, Buffer.from(this.#secretKeySub1, 'hex'));
    return Buffer.from(tmp1).toString('hex');
  };

  /**
   * 3DES decryption
   * @param {String} encryptText
   * @returns {String} plainText
   *
   */
  decrypt3Des = (encryptText: string) => {
    let tmp1 = this.#decrypt(
      Buffer.from(encryptText, 'hex'),
      Buffer.from(this.#secretKeySub1, 'hex')
    );
    const tmp2 = this.#encrypt(tmp1, Buffer.from(this.#secretKeySub2, 'hex'));
    tmp1 = this.#decrypt(tmp2, Buffer.from(this.#secretKeySub1, 'hex'));
    return Buffer.from(tmp1).toString('hex');
  };

  encrypt = (plainText: string) => {
    if (this.#secretKeySub2) return this.encrypt3Des(plainText);
    return this.encryptDes(plainText);
  };

  decrypt = (encryptedText: string) => {
    if (this.#secretKeySub2) return this.decrypt3Des(encryptedText);
    return this.decryptDes(encryptedText);
  };
}
