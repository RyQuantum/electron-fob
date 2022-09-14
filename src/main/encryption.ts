import crypto from 'crypto';

export default class Encryption {
  // 秘钥
  secretKey = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';

  #secretKeySub1 = '';

  #secretKeySub2 = '';

  algorithms = 'des-ecb';

  /**
   * @param {String} secretKey        秘钥
   */
  constructor(secretKey) {
    if (typeof secretKey === 'string') this.secretKey = secretKey;
    this.#secretKeySub1 = this.secretKey.substring(0, 16);
    this.#secretKeySub2 = this.secretKey.substring(16, 32);
  }

  /**
   * crypto加密
   * @param {Buffer} plainText        明文
   * @param {Buffer} secretKeyText    密钥
   * @returns {String}                密文
   */
  encrypt(plainText, secretKeyText) {
    const key = new Uint8Array(secretKeyText);
    const iv = new Uint8Array();
    const txt = new Uint8Array(plainText);
    const cipher = crypto.createCipheriv(this.algorithms, key, iv);
    cipher.setAutoPadding(true);
    const ciph = cipher.update(txt);
    return ciph;
  }

  /**
   * crypto解密
   * @param {String} encryptText      密文
   * @param {String} secretKeyText    密钥
   * @returns {String}                明文
   */
  decrypt(encryptText, secretKeyText) {
    const key = new Uint8Array(secretKeyText);
    const iv = new Uint8Array();
    const txt = new Uint8Array(encryptText);
    const deCipher = crypto.createDecipheriv(this.algorithms, key, iv);
    deCipher.setAutoPadding(true);
    deCipher.update(txt);
    const ciph = deCipher.update(txt);
    return ciph;
  }

  encryptDes(plainText) {
    const buffer = Buffer.from(plainText, 'hex');
    return this.encrypt(buffer, Buffer.from(this.#secretKeySub1, 'hex'));
  }

  decryptDes(plainText) {
    const buffer = Buffer.from(plainText, 'hex');
    return this.decrypt(buffer, Buffer.from(this.#secretKeySub1, 'hex'));
  }

  /**
   * 3DES加密
   * @param {String} plainText    明文
   * @returns {String}            密文
   *
   * 3DES算法是指使用双长度（16字节）密钥K=（KL||KR）将8字节明文数据块进行3次DES加密/解密。如：
   * Y = DES( KL[DES-1( KR[DES( KL[X] )] )] )
   *
   * VOID 3DES(BYTE DoubleKeyStr[16]， BYTE Data[8]， BYTE Out[8])
   * {
   *     BYTE Buf1[8]， Buf2[8];
   *     DES (&DoubleKeyStr[0]， Data， Buf1);
   *     UDES(&DoubleKeyStr[8]， Buf1， Buf2);
   *     DES (&DoubleKeyStr[0]， Buf2， Out);
   * }
   */
  encrypt3Des(plainText) {
    let tmp1 = null;
    let tmp2 = null;
    tmp2 = this.encrypt(
      Buffer.from(plainText, 'hex').toJSON().data,
      Buffer.from(this.#secretKeySub1, 'hex').toJSON().data
    );
    tmp1 = this.decrypt(
      tmp2,
      Buffer.from(this.#secretKeySub2, 'hex').toJSON().data
    );
    tmp2 = this.encrypt(
      tmp1,
      Buffer.from(this.#secretKeySub1, 'hex').toJSON().data
    );
    return Buffer.from(tmp2).toString('hex');
  }

  /**
   * 3DES解密
   * @param {String} encryptText  密文
   * @returns {String}            明文
   *
   * 解密方式为:
   * X = DES-1( KL[DES( KR[DES-1( KL[Y] )] )] )
   * 其中，DES( KL[X] )表示用密钥K对数据X进行DES加密，DES-1( KR[Y] )表示用密钥K对数据Y进行解密。
   * SessionKey的计算采用3DES算法，计算出单倍长度的密钥。表示法为:SK = Session(DK，DATA)
   */
  decrypt3Des(encryptText) {
    let tmp1 = null;
    let tmp2 = null;
    tmp2 = this.decrypt(
      Buffer.from(encryptText, 'hex').toJSON().data,
      Buffer.from(this.#secretKeySub1, 'hex').toJSON().data
    );
    tmp1 = this.encrypt(
      tmp2,
      Buffer.from(this.#secretKeySub2, 'hex').toJSON().data
    );
    tmp2 = this.decrypt(
      tmp1,
      Buffer.from(this.#secretKeySub1, 'hex').toJSON().data
    );
    return Buffer.from(tmp2).toString('hex');
  }
}
