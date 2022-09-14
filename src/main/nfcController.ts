import { NFC } from 'nfc-pcsc';
import Encryption from './encryption';

const nfc = new NFC(); // optionally you can pass logger
let myReader;
nfc.on('reader', async (reader) => {
  myReader = reader;
  console.log(`device attached`, reader.reader.name);
  reader.autoProcessing = false;

  reader.on('card', async (card) => {
    console.log(`card detected`, card);

    const res = await reader.transmit(
      Buffer.from([0xff, 0x00, 0x50, 0xff, 0x00]),
      10
    );
    // const res = await reader.transmit(Buffer.from('00A40000023F00', 'hex'), 50);
    // const res = await reader.transmit(Buffer.from('008400000400000000', 'hex'), 6);
    // console.log('res:', res);
  });

  reader.on('card.off', (card) => {
    console.log(`${reader.reader.name}  card removed`, card);
  });

  reader.on('error', (err) => {
    console.log(`an error occurred`, reader, err);
  });

  reader.on('end', () => {
    console.log(`device removed`, reader);
  });
});

nfc.on('error', (err) => {
  console.log(`an error occurred`, err);
});

export default {
  send: async () => {
    let res = await myReader.transmit(
      Buffer.from('008400000400000000', 'hex'),
      6
    );
    console.log('res:', res);
    const randomStr = res.slice(0, 4).toString('hex');
    const encryption = new Encryption('95FD677E92AA7C051E70928A3D5C0D95');
    const encrypted = encryption.encrypt3Des(`${randomStr}00000000`);
    console.log('enc', encrypted);
    const req = `0082000008${encrypted.toString('hex')}`;
    res = await myReader.transmit(Buffer.from(req, 'hex'), 6);
    console.log('res', res);
  },
};
